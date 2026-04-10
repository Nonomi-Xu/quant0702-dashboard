from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import DATA_DIR, PUBLIC_DIR
from .services.analysis_store import AnalysisStore


app = FastAPI(
    title="A 股因子评测看板",
    version="0.1.0",
)
store = AnalysisStore(DATA_DIR)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/factors")
def list_factors() -> dict[str, object]:
    factors = store.list_factors()
    return {
        "factors": factors,
        "factor_options": store.factor_options(factors),
        "default_factor": factors[0] if factors else "relative_strength_index_6",
    }


@app.get("/api/factor-metadata")
def list_factor_metadata() -> dict[str, object]:
    return {
        "metadata": store.read_factor_metadata(),
    }


@app.get("/api/factors/{factor}/horizons")
def list_horizons(factor: str) -> dict[str, object]:
    return {
        "factor": factor,
        "horizons": store.list_horizons(factor),
    }


@app.get("/api/analysis")
def get_analysis(factor: str = "relative_strength_index_6", horizon: int = 5) -> dict[str, object]:
    try:
        return store.read_analysis(factor=factor, horizon=horizon)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/comparisons/factor/{factor}/summary")
def compare_factor_horizons(factor: str) -> dict[str, object]:
    return {
        "factor": factor,
        "rows": store.compare_factor_horizons(factor),
    }


@app.get("/api/comparisons/horizon/{horizon}/summary")
def compare_horizon_factors(horizon: int) -> dict[str, object]:
    return {
        "horizon": horizon,
        "rows": store.compare_horizon_factors(horizon),
    }


app.mount("/assets", StaticFiles(directory=PUBLIC_DIR), name="assets")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(PUBLIC_DIR / "index.html")
