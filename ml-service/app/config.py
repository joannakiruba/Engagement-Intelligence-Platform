import os
from pathlib import Path

MODEL_DIR = Path(os.getenv("MODEL_DIR", str(Path(__file__).resolve().parent.parent / "models")))
MODEL_PATH = MODEL_DIR / "risk_model.joblib"
MODEL_NAME = "logistic_regression"
MODEL_VERSION = "1.0"

FEATURE_ORDER = [
    "attendancePercentage",
    "assessmentPercentage",
    "averageEffortRating",
    "averageParticipationRating",
    "negativeFeedbackCount",
]
FEATURE_VERSION = "1.0"

RISK_CLASSES = ["HIGH", "LOW", "MEDIUM"]

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
