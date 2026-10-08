import os
from pathlib import Path
from dotenv import load_dotenv

# Load the environment variables from the .env file
load_dotenv()

MODEL_DIR = Path(os.getenv("MODEL_DIR", str(Path(__file__).resolve().parents[1] / "models")))
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
PORT = int(os.getenv("PORT", "8080"))

DATABASE_URL = os.getenv("DATABASE_URL", "")
DB_POOL_MIN_SIZE = int(os.getenv("DB_POOL_MIN_SIZE", "1"))
DB_POOL_MAX_SIZE = int(os.getenv("DB_POOL_MAX_SIZE", "5"))
NODE_API_URL = os.getenv("NODE_API_URL", "")
ML_CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ML_CORS_ORIGINS", "").split(";")
    if origin.strip()
]

RISK_THRESHOLDS = {
    "low_max": 30,
    "medium_max": 60,
    "high_min": 61,
}

ALERT_COOLDOWN_DAYS = 7
CHRONIC_REALERT_DAYS = 14
ANOMALY_CONTAMINATION = 0.1
