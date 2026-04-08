from __future__ import annotations

import json
import math
import os
import tempfile
from datetime import date, datetime
from pathlib import Path
from typing import Any

import polars as pl
from qcloud_cos import CosConfig, CosS3Client


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("FACTOR_DASHBOARD_DATA_DIR", PROJECT_ROOT / "data")).resolve()
COS_PREFIX = os.environ.get("FACTOR_DASHBOARD_COS_ANALYSIS_PREFIX", "a-stock/factor/analysis").strip("/")
IC_POINTS_LIMIT = int(os.environ.get("FACTOR_DASHBOARD_IC_POINTS_LIMIT", "260"))


def build_cos_client() -> tuple[CosS3Client, str]:
    bucket = os.environ.get("COS_BUCKET")
    if not bucket:
        raise RuntimeError("缺少环境变量 COS_BUCKET")

    config = CosConfig(
        Region=os.environ.get("COS_REGION", "ap-guangzhou"),
        SecretId=os.environ.get("COS_SECRET_ID"),
        SecretKey=os.environ.get("COS_SECRET_KEY"),
        Endpoint=os.environ.get("COS_ENDPOINT", "cos.ap-guangzhou.myqcloud.com"),
    )
    return CosS3Client(config), bucket


def list_cos_keys(client: CosS3Client, bucket: str, prefix: str) -> list[str]:
    keys: list[str] = []
    marker = ""
    while True:
        response = client.list_objects(
            Bucket=bucket,
            Prefix=f"{prefix}/",
            Marker=marker,
            MaxKeys=1000,
        )
        keys.extend(item["Key"] for item in response.get("Contents", []))
        if response.get("IsTruncated") == "true":
            marker = response.get("NextMarker", "")
            continue
        return keys


def discover_completed_results(keys: list[str]) -> dict[tuple[str, int], set[str]]:
    results: dict[tuple[str, int], set[str]] = {}
    for key in keys:
        relative = key.removeprefix(f"{COS_PREFIX}/")
        parts = relative.split("/")
        if len(parts) != 3:
            continue

        factor_name, horizon_name, filename = parts
        if not horizon_name.startswith("horizon_") or not filename.endswith(".parquet"):
            continue

        try:
            horizon = int(horizon_name.removeprefix("horizon_"))
        except ValueError:
            continue

        results.setdefault((factor_name, horizon), set()).add(filename)
    return results


def download_parquet(client: CosS3Client, bucket: str, key: str, cache_dir: Path) -> pl.DataFrame:
    local_path = cache_dir / key.replace("/", "__")
    response = client.get_object(Bucket=bucket, Key=key)
    local_path.write_bytes(response["Body"].get_raw_stream().read())
    return pl.read_parquet(local_path)


def value_to_json(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value_to_json(value) for key, value in row.items()}


def latest_row(frame: pl.DataFrame) -> dict[str, Any]:
    if frame.is_empty():
        return {}
    if "trade_date" in frame.columns:
        frame = frame.sort("trade_date")
    return row_to_dict(frame.tail(1).to_dicts()[0])


def summary_row(frame: pl.DataFrame, factor_name: str, horizon: int) -> dict[str, Any]:
    if frame.is_empty():
        return {"factor": factor_name, "horizon": horizon, "status": "empty"}
    row = row_to_dict(frame.head(1).to_dicts()[0])
    row.setdefault("factor", factor_name)
    row.setdefault("horizon", horizon)
    return row


def ic_timeseries(frame: pl.DataFrame) -> list[dict[str, Any]]:
    if frame.is_empty():
        return []
    columns = [column for column in ["trade_date", "ic"] if column in frame.columns]
    if not columns:
        return []
    frame = frame.select(columns)
    if "trade_date" in frame.columns:
        frame = frame.sort("trade_date")
    if IC_POINTS_LIMIT > 0:
        frame = frame.tail(IC_POINTS_LIMIT)
    return [row_to_dict(row) for row in frame.to_dicts()]


def latest_group_returns(frame: pl.DataFrame) -> dict[str, Any]:
    row = latest_row(frame)
    return {
        key: value
        for key, value in row.items()
        if key.startswith("group_") or key == "long_short"
    }


def read_metadata() -> dict[str, dict[str, Any]]:
    metadata_file = DATA_DIR / "factor-metadata.json"
    if not metadata_file.exists():
        return {}
    return json.loads(metadata_file.read_text(encoding="utf-8"))


def sync_one_result(
    client: CosS3Client,
    bucket: str,
    factor_name: str,
    horizon: int,
    filenames: set[str],
    metadata: dict[str, dict[str, Any]],
    cache_dir: Path,
) -> bool:
    required = {"summary.parquet", "ic.parquet", "group_returns.parquet", "monitor.parquet", "raw_monitor.parquet"}
    if not required.issubset(filenames):
        return False

    base_key = f"{COS_PREFIX}/{factor_name}/horizon_{horizon}"
    summary = download_parquet(client, bucket, f"{base_key}/summary.parquet", cache_dir)
    ic = download_parquet(client, bucket, f"{base_key}/ic.parquet", cache_dir)
    group_returns = download_parquet(client, bucket, f"{base_key}/group_returns.parquet", cache_dir)
    monitor = download_parquet(client, bucket, f"{base_key}/monitor.parquet", cache_dir)
    raw_monitor = download_parquet(client, bucket, f"{base_key}/raw_monitor.parquet", cache_dir)

    payload = {
        "factor": factor_name,
        "horizon": horizon,
        "updated_at": date.today().isoformat(),
        "metadata": {
            "field_name": factor_name,
            "formula": "-",
            "source": f"{COS_PREFIX}/{factor_name}/horizon_{horizon}",
            **metadata.get(factor_name, {}),
        },
        "summary": summary_row(summary, factor_name, horizon),
        "monitor_latest": latest_row(monitor),
        "raw_monitor_latest": latest_row(raw_monitor),
        "ic_timeseries": ic_timeseries(ic),
        "group_returns": latest_group_returns(group_returns),
    }

    output_path = DATA_DIR / "factors" / factor_name / f"horizon_{horizon}" / "analysis.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return True


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    client, bucket = build_cos_client()
    keys = list_cos_keys(client, bucket, COS_PREFIX)
    discovered = discover_completed_results(keys)
    metadata = read_metadata()

    synced = 0
    with tempfile.TemporaryDirectory(prefix="factor-dashboard-cos-") as tmpdir:
        cache_dir = Path(tmpdir)
        for (factor_name, horizon), filenames in sorted(discovered.items()):
            if sync_one_result(client, bucket, factor_name, horizon, filenames, metadata, cache_dir):
                synced += 1

    print(f"synced {synced} factor horizon result(s) into {DATA_DIR / 'factors'}")


if __name__ == "__main__":
    main()
