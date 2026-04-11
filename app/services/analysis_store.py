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
        self.pattern_metadata_file = data_dir / "pattern-factor-metadata.json"
        self.factor_results_dir = data_dir / "factors"
        self.pattern_results_dir = data_dir / "pattern_factors"

    def read_factor_metadata(self) -> dict[str, dict[str, Any]]:
        if not self.metadata_file.exists():
            return {}
        return json.loads(self.metadata_file.read_text(encoding="utf-8"))

    def read_pattern_factor_metadata(self) -> dict[str, dict[str, Any]]:
        if not self.pattern_metadata_file.exists():
            return {}
        return json.loads(self.pattern_metadata_file.read_text(encoding="utf-8"))

    def _has_analysis_result(self, factor_dir: Path) -> bool:
        return any(
            path.is_dir()
            and path.name.startswith("horizon_")
            and (path / "analysis.json").exists()
            for path in factor_dir.iterdir()
        )

    def list_factors(self) -> list[str]:
        if not self.factor_results_dir.exists():
            return []
        factors = [
            path.name
            for path in self.factor_results_dir.iterdir()
            if path.is_dir() and self._has_analysis_result(path)
        ]
        return sorted(factors)

    def factor_options(self, factors: list[str]) -> list[dict[str, str]]:
        return [{"value": factor, "label": self.factor_display_label(factor)} for factor in factors]

    def factor_display_label(self, factor: str) -> str:
        metadata = self.read_factor_metadata()
        factor_metadata = metadata.get(factor, {})
        return (
            factor_metadata.get("display_label")
            or factor_metadata.get("display_name")
            or factor_metadata.get("label")
            or factor
        )

    def pattern_factor_display_label(self, factor: str) -> str:
        metadata = self.read_pattern_factor_metadata()
        factor_metadata = metadata.get(factor, {})
        return (
            factor_metadata.get("display_label")
            or factor_metadata.get("display_name")
            or factor_metadata.get("label")
            or factor
        )

    def list_pattern_factors(self) -> list[str]:
        if self.pattern_results_dir.exists():
            factors = [
                path.name
                for path in self.pattern_results_dir.iterdir()
                if path.is_dir() and self._has_analysis_result(path)
            ]
            if factors:
                return sorted(factors)
        return sorted(self.read_pattern_factor_metadata().keys())

    def pattern_factor_options(self, factors: list[str]) -> list[dict[str, str]]:
        return [{"value": factor, "label": self.pattern_factor_display_label(factor)} for factor in factors]

    def summary_with_display_factor(self, summary: dict[str, Any], factor: str) -> dict[str, Any]:
        row = dict(summary)
        row["factor_key"] = factor
        row["factor"] = self.factor_display_label(factor)
        return row

    def pattern_summary_with_display_factor(self, summary: dict[str, Any], factor: str) -> dict[str, Any]:
        row = dict(summary)
        row["factor_key"] = factor
        row["factor"] = self.pattern_factor_display_label(factor)
        return row

    def list_horizons(self, factor: str) -> list[int]:
        return self._list_horizons_in_dir(self.factor_results_dir / factor)

    def list_pattern_horizons(self, factor: str) -> list[int]:
        return self._list_horizons_in_dir(self.pattern_results_dir / factor)

    def _list_horizons_in_dir(self, factor_dir: Path) -> list[int]:
        if not factor_dir.exists():
            return []

        horizons: list[int] = []
        for path in factor_dir.iterdir():
            if path.is_dir() and path.name.startswith("horizon_") and (path / "analysis.json").exists():
                try:
                    horizons.append(int(path.name.removeprefix("horizon_")))
                except ValueError:
                    continue
        return sorted(horizons)

    def _analysis_file(self, factor: str, horizon: str | int) -> Path:
        return self.factor_results_dir / factor / f"horizon_{horizon}" / "analysis.json"

    def _pattern_analysis_file(self, factor: str, horizon: str | int) -> Path:
        return self.pattern_results_dir / factor / f"horizon_{horizon}" / "analysis.json"

    def _read_real_analysis(self, factor: str, horizon: str | int) -> dict[str, Any] | None:
        target_file = self._analysis_file(factor, horizon)
        if not target_file.exists():
            return None

        payload = json.loads(target_file.read_text(encoding="utf-8"))
        payload.setdefault("factor", factor)
        payload.setdefault("horizon", int(horizon))
        payload.setdefault("updated_at", datetime.fromtimestamp(target_file.stat().st_mtime).date().isoformat())
        return payload

    def compare_factor_horizons(self, factor: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for horizon in self.list_horizons(factor):
            payload = self._read_real_analysis(factor, horizon)
            if payload is None:
                continue
            rows.append(self.summary_with_display_factor(payload.get("summary", {}), factor))

        return rows

    def compare_horizon_factors(self, horizon: str | int) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for factor in self.list_factors():
            payload = self._read_real_analysis(factor, horizon)
            if payload is None:
                continue
            rows.append(self.summary_with_display_factor(payload.get("summary", {}), factor))

        return rows

    def read_pattern_analysis(self, factor: str, horizon: str | int) -> dict[str, Any] | None:
        target_file = self._pattern_analysis_file(factor, horizon)
        if not target_file.exists():
            return None

        payload = json.loads(target_file.read_text(encoding="utf-8"))
        payload.setdefault("factor", factor)
        payload.setdefault("horizon", int(horizon))
        payload.setdefault("updated_at", datetime.fromtimestamp(target_file.stat().st_mtime).date().isoformat())
        return payload

    def compare_pattern_factor_horizons(self, factor: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for horizon in self.list_pattern_horizons(factor):
            payload = self.read_pattern_analysis(factor, horizon)
            if payload is None:
                continue
            rows.append(self.pattern_summary_with_display_factor(payload.get("summary", {}), factor))
        return rows

    def compare_pattern_horizon_factors(self, horizon: str | int) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for factor in self.list_pattern_factors():
            payload = self.read_pattern_analysis(factor, horizon)
            if payload is None:
                continue
            rows.append(self.pattern_summary_with_display_factor(payload.get("summary", {}), factor))
        return rows

    def read_analysis(self, factor: str, horizon: str | int) -> dict[str, Any]:
        horizon_value = str(horizon)
        target_file = self._analysis_file(factor, horizon_value)
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
            **payload_metadata,
            **registry_metadata,
        }
        return payload
