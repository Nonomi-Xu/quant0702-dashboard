from __future__ import annotations

import json
import math
import os
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import polars as pl
from qcloud_cos import CosConfig, CosS3Client


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("FACTOR_DASHBOARD_DATA_DIR", PROJECT_ROOT / "data")).resolve()
COS_PREFIX = os.environ.get("FACTOR_DASHBOARD_COS_ANALYSIS_PREFIX", "a-stock/factor/analysis").strip("/")
FACTOR_PREFIX = os.environ.get(
    "FACTOR_DASHBOARD_COS_FACTOR_PREFIX",
    COS_PREFIX.removesuffix("/analysis") + "/factors",
).strip("/")
IC_LOOKBACK_DAYS = int(os.environ.get("FACTOR_DASHBOARD_IC_LOOKBACK_DAYS", "90"))
FACTOR_LOOKBACK_YEARS = int(os.environ.get("FACTOR_DASHBOARD_FACTOR_LOOKBACK_YEARS", "10"))


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


def discover_completed_results(keys: list[str]) -> dict[tuple[str, int, str], set[str]]:
    results: dict[tuple[str, int, str], set[str]] = {}
    for key in keys:
        relative = key.removeprefix(f"{COS_PREFIX}/")
        parts = relative.split("/")
        if len(parts) != 4:
            continue

        category, factor_name, horizon_name, filename = parts
        if not category:
            continue
        if not horizon_name.startswith("horizon_") or not filename.endswith(".parquet"):
            continue

        try:
            horizon = int(horizon_name.removeprefix("horizon_"))
        except ValueError:
            continue

        base_key = key[: -(len(filename) + 1)]
        results.setdefault((factor_name, horizon, base_key), set()).add(filename)
    return results


def download_parquet(client: CosS3Client, bucket: str, key: str, cache_dir: Path) -> pl.DataFrame:
    local_path = cache_dir / key.replace("/", "__")
    response = client.get_object(Bucket=bucket, Key=key)
    local_path.write_bytes(response["Body"].get_raw_stream().read())
    return pl.read_parquet(local_path)


def try_download_parquet(client: CosS3Client, bucket: str, key: str, cache_dir: Path) -> pl.DataFrame | None:
    try:
        return download_parquet(client, bucket, key, cache_dir)
    except Exception:
        return None


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


def enrich_summary_sample_counts(summary: dict[str, Any], ic: pl.DataFrame) -> dict[str, Any]:
    required_keys = {
        "avg_daily_sample_count",
        "min_daily_sample_count",
        "max_daily_sample_count",
    }
    if required_keys.issubset(summary.keys()) or ic.is_empty() or "sample_count" not in ic.columns:
        return summary

    sample_counts = ic.select(pl.col("sample_count").drop_nulls())
    if sample_counts.is_empty():
        return summary

    enriched = dict(summary)
    enriched.setdefault("avg_daily_sample_count", sample_counts.select(pl.col("sample_count").mean()).item())
    enriched.setdefault("min_daily_sample_count", sample_counts.select(pl.col("sample_count").min()).item())
    enriched.setdefault("max_daily_sample_count", sample_counts.select(pl.col("sample_count").max()).item())
    return enriched


def parse_date_value(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        return None

    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def ic_timeseries(frame: pl.DataFrame, updated_at: date | None) -> list[dict[str, Any]]:
    if frame.is_empty():
        return []
    columns = [column for column in ["trade_date", "ic"] if column in frame.columns]
    if not columns:
        return []
    frame = frame.select(columns)
    if "trade_date" in frame.columns:
        frame = frame.with_columns(pl.col("trade_date").cast(pl.Date)).sort("trade_date")

    if updated_at is None and "trade_date" in frame.columns and not frame.is_empty():
        updated_at = frame.select(pl.col("trade_date").max()).item()

    if updated_at is not None and IC_LOOKBACK_DAYS > 0:
        start_date = updated_at - timedelta(days=IC_LOOKBACK_DAYS)
        frame = frame.filter((pl.col("trade_date") >= start_date) & (pl.col("trade_date") <= updated_at))

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


def factor_path_prefixes(factor_name: str, factor_metadata: dict[str, Any]) -> list[str]:
    prefixes: list[str] = []
    factor_path = str(factor_metadata.get("factor_path") or "").strip("/")
    category = str(factor_metadata.get("category") or "").strip("/")

    if factor_path:
        prefixes.append(factor_path)
        prefixes.append(f"a-stock/{factor_path}")

    if category:
        prefixes.append(f"{FACTOR_PREFIX}/{category}/{factor_name}")

    prefixes.append(f"{FACTOR_PREFIX}/{factor_name}")
    prefixes.append(f"a-stock/factor/factors/{factor_name}")
    prefixes.append(f"factor/factors/{factor_name}")

    deduplicated: list[str] = []
    for prefix in prefixes:
        prefix = prefix.strip("/")
        if prefix and prefix not in deduplicated:
            deduplicated.append(prefix)
    return deduplicated


def latest_factor_signals(
    client: CosS3Client,
    bucket: str,
    factor_name: str,
    factor_metadata: dict[str, Any],
    cache_dir: Path,
) -> dict[str, Any]:
    current_year = date.today().year
    years = range(current_year, current_year - FACTOR_LOOKBACK_YEARS - 1, -1)
    required_columns = {"ts_code", "trade_date", factor_name}

    for year in years:
        for prefix in factor_path_prefixes(factor_name, factor_metadata):
            key = f"{prefix}/{factor_name}_{year}.parquet"
            frame = try_download_parquet(client, bucket, key, cache_dir)
            if frame is None or frame.is_empty() or not required_columns.issubset(frame.columns):
                continue

            latest_date = frame.select(pl.col("trade_date").max()).item()
            latest_frame = (
                frame
                .select(["ts_code", "trade_date", factor_name])
                .filter(pl.col("trade_date") == latest_date)
                .drop_nulls(factor_name)
            )
            if latest_frame.is_empty():
                continue

            top_frame = latest_frame.sort(factor_name, descending=True).head(10)
            bottom_frame = latest_frame.sort(factor_name, descending=False).head(10)

            return {
                "updated_at": f"{value_to_json(latest_date)} 20:00",
                "source": key,
                "top_rows": [
                    row_to_dict({**row, "factor_value": row.get(factor_name)})
                    for row in top_frame.to_dicts()
                ],
                "bottom_rows": [
                    row_to_dict({**row, "factor_value": row.get(factor_name)})
                    for row in bottom_frame.to_dicts()
                ],
            }

    return {"updated_at": "-", "source": "-", "top_rows": [], "bottom_rows": []}


def sync_one_result(
    client: CosS3Client,
    bucket: str,
    factor_name: str,
    horizon: int,
    base_key: str,
    filenames: set[str],
    metadata: dict[str, dict[str, Any]],
    strong_signal_cache: dict[str, dict[str, Any]],
    cache_dir: Path,
) -> bool:
    required = {"summary.parquet", "ic.parquet", "group_returns.parquet", "monitor.parquet", "raw_monitor.parquet"}
    if not required.issubset(filenames):
        return False

    summary = download_parquet(client, bucket, f"{base_key}/summary.parquet", cache_dir)
    ic = download_parquet(client, bucket, f"{base_key}/ic.parquet", cache_dir)
    group_returns = download_parquet(client, bucket, f"{base_key}/group_returns.parquet", cache_dir)
    monitor = download_parquet(client, bucket, f"{base_key}/monitor.parquet", cache_dir)
    raw_monitor = download_parquet(client, bucket, f"{base_key}/raw_monitor.parquet", cache_dir)
    summary_payload = summary_row(summary, factor_name, horizon)
    summary_payload = enrich_summary_sample_counts(summary_payload, ic)
    summary_updated_at = parse_date_value(summary_payload.get("updated_at"))
    factor_metadata = metadata.get(factor_name, {})
    strong_signals = strong_signal_cache.setdefault(
        factor_name,
        latest_factor_signals(client, bucket, factor_name, factor_metadata, cache_dir),
    )

    payload = {
        "factor": factor_name,
        "horizon": horizon,
        "updated_at": date.today().isoformat(),
        "metadata": {
            "field_name": factor_name,
            "formula": "-",
            "source": base_key,
            **factor_metadata,
        },
        "summary": summary_payload,
        "monitor_latest": latest_row(monitor),
        "raw_monitor_latest": latest_row(raw_monitor),
        "ic_timeseries": ic_timeseries(ic, summary_updated_at),
        "group_returns": latest_group_returns(group_returns),
        "factor_signals": strong_signals,
        "strong_signals": strong_signals,
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
    strong_signal_cache: dict[str, dict[str, Any]] = {}

    synced = 0
    incomplete = 0
    with tempfile.TemporaryDirectory(prefix="factor-dashboard-cos-") as tmpdir:
        cache_dir = Path(tmpdir)
        for (factor_name, horizon, base_key), filenames in sorted(discovered.items()):
            if sync_one_result(
                client,
                bucket,
                factor_name,
                horizon,
                base_key,
                filenames,
                metadata,
                strong_signal_cache,
                cache_dir,
            ):
                synced += 1
            else:
                incomplete += 1

    print(f"synced {synced} factor horizon result(s) into {DATA_DIR / 'factors'}")
    if synced == 0:
        print(
            "no completed result set found under "
            f"{COS_PREFIX} (discovered {len(discovered)} horizon path(s), incomplete {incomplete})"
        )


if __name__ == "__main__":
    main()
