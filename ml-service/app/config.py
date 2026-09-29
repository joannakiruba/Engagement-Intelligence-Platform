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

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/hope_platform")
NODE_API_URL = os.getenv("NODE_API_URL", "http://localhost:3000")

RISK_THRESHOLDS = {
    "low_max": 30,
    "medium_max": 60,
    "high_min": 61,
}

ALERT_COOLDOWN_DAYS = 7
CHRONIC_REALERT_DAYS = 14
ANOMALY_CONTAMINATION = 0.1
