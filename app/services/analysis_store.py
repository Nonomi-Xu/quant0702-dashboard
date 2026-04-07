from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


class AnalysisStore:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.sample_file = data_dir / "sample-factor-analysis.json"
        self.metadata_file = data_dir / "factor-metadata.json"

    def read_factor_metadata(self) -> dict[str, dict[str, Any]]:
        if not self.metadata_file.exists():
            return {}
        return json.loads(self.metadata_file.read_text(encoding="utf-8"))

    def list_factors(self) -> list[str]:
        metadata = self.read_factor_metadata()
        if metadata:
            return sorted(metadata)

        factors_dir = self.data_dir / "factors"
        if not factors_dir.exists():
            sample = self.read_analysis("relative_strength_index_6", "5")
            return [sample.get("factor", "relative_strength_index_6")]
        factors = [path.name for path in factors_dir.iterdir() if path.is_dir()]
        return sorted(factors) or ["relative_strength_index_6"]

    def list_horizons(self, factor: str) -> list[int]:
        factor_dir = self.data_dir / "factors" / factor
        if not factor_dir.exists():
            return [1, 5, 10, 20]

        horizons: list[int] = []
        for path in factor_dir.iterdir():
            if path.is_dir() and path.name.startswith("horizon_"):
                try:
                    horizons.append(int(path.name.removeprefix("horizon_")))
                except ValueError:
                    continue
        return sorted(horizons) or [1, 5, 10, 20]

    def read_analysis(self, factor: str, horizon: str | int) -> dict[str, Any]:
        horizon_value = str(horizon)
        target_file = self.data_dir / "factors" / factor / f"horizon_{horizon_value}" / "analysis.json"
        if not target_file.exists():
            target_file = self.sample_file
        payload = json.loads(target_file.read_text(encoding="utf-8"))
        payload.setdefault("factor", factor)
        payload.setdefault("horizon", int(horizon_value))
        payload.setdefault("updated_at", datetime.fromtimestamp(target_file.stat().st_mtime).date().isoformat())

        registry_metadata = self.read_factor_metadata().get(payload["factor"], {})
        payload_metadata = payload.get("metadata", {})
        payload["metadata"] = {
            "field_name": payload["factor"],
            "formula": "-",
            "source": str(target_file.relative_to(self.data_dir)),
            **registry_metadata,
            **payload_metadata,
        }
        return payload
