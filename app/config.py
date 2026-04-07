from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = PROJECT_ROOT / "public"
DATA_DIR = Path(os.environ.get("FACTOR_DASHBOARD_DATA_DIR", PROJECT_ROOT / "data")).resolve()
