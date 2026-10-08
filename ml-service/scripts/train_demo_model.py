"""Train a reproducible demo risk model from synthetic examples.

This artifact is for local demos and integration testing only. It is not a
validated model and must not be used to make real student-risk decisions.
Replace the synthetic examples with reviewed, consented training data and run
appropriate validation before production use.
"""

from datetime import datetime, timezone
from pathlib import Path
import sys

import numpy as np

# Allow both `python scripts/train_demo_model.py` and module invocation from
# the ml-service directory.
SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.config import FEATURE_ORDER, MODEL_PATH
from app.risk_engine.calculator import train_and_save


def main() -> None:
    # Each row follows FEATURE_ORDER:
    # attendance %, assessment %, effort, participation, negative feedback count.
    features = np.array([
        [90, 80, 4.0, 4.0, 0],
        [85, 70, 3.5, 3.5, 1],
        [95, 90, 5.0, 5.0, 0],
        [80, 75, 3.0, 3.0, 0],
        [60, 45, 2.5, 2.5, 3],
        [55, 40, 2.0, 2.0, 4],
        [50, 35, 2.0, 2.5, 5],
        [70, 48, 2.5, 2.0, 3],
        [30, 20, 1.0, 1.0, 8],
        [25, 15, 1.5, 1.0, 10],
        [20, 10, 1.0, 1.0, 12],
        [35, 25, 1.5, 1.5, 7],
    ], dtype=float)
    labels = np.array([
        "LOW", "LOW", "LOW", "LOW",
        "MEDIUM", "MEDIUM", "MEDIUM", "MEDIUM",
        "HIGH", "HIGH", "HIGH", "HIGH",
    ])

    if features.shape[1] != len(FEATURE_ORDER):
        raise ValueError("Demo feature rows do not match configured FEATURE_ORDER")

    train_and_save(
        features,
        labels,
        datetime.now(timezone.utc).isoformat(),
    )
    print(f"Wrote synthetic demo model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
