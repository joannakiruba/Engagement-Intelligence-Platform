from pathlib import Path
from typing import Optional
import logging

import joblib
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

from app.config import MODEL_PATH, MODEL_NAME, MODEL_VERSION, FEATURE_ORDER, FEATURE_VERSION, RISK_CLASSES

logger = logging.getLogger(__name__)

_model: Optional[Pipeline] = None
_trained_at: Optional[str] = None


def create_pipeline() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(
            solver="lbfgs",
            max_iter=1000,
            random_state=42,
        )),
    ])


def load_model() -> bool:
    global _model, _trained_at
    if not MODEL_PATH.exists():
        logger.info("No model artifact found at %s", MODEL_PATH)
        _model = None
        _trained_at = None
        return False
    try:
        artifact = joblib.load(MODEL_PATH)
        _model = artifact["pipeline"]
        _trained_at = artifact.get("trained_at")
        logger.info("Model loaded from %s (trained_at=%s)", MODEL_PATH, _trained_at)
        return True
    except Exception:
        logger.exception("Failed to load model from %s", MODEL_PATH)
        _model = None
        _trained_at = None
        return False


def is_model_ready() -> bool:
    return _model is not None


def get_model_metadata() -> dict:
    return {
        "name": MODEL_NAME,
        "version": MODEL_VERSION,
        "featureVersion": FEATURE_VERSION,
        "trainedAt": _trained_at,
    }


def build_feature_vector(features: dict) -> np.ndarray:
    return np.array([[features[f] for f in FEATURE_ORDER]])


def predict(features: dict) -> dict:
    if _model is None:
        return {"status": "NOT_READY"}

    try:
        X = build_feature_vector(features)
        prediction = _model.predict(X)[0]
        proba = _model.predict_proba(X)[0]

        class_labels = list(_model.classes_)
        prob_dict = {}
        for cls in RISK_CLASSES:
            if cls in class_labels:
                prob_dict[cls] = round(float(proba[class_labels.index(cls)]), 4)
            else:
                prob_dict[cls] = 0.0

        if prediction not in RISK_CLASSES:
            return {"status": "INVALID_PREDICTION"}

        return {
            "status": "READY",
            "prediction": prediction,
            "probabilities": prob_dict,
            "model": get_model_metadata(),
        }
    except Exception:
        logger.exception("Prediction failed")
        return {"status": "ERROR"}


def train_and_save(X: np.ndarray, y: np.ndarray, trained_at: str) -> Pipeline:
    pipeline = create_pipeline()
    pipeline.fit(X, y)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "pipeline": pipeline,
        "trained_at": trained_at,
        "feature_order": FEATURE_ORDER,
        "feature_version": FEATURE_VERSION,
        "classes": RISK_CLASSES,
    }
    joblib.dump(artifact, MODEL_PATH)

    global _model, _trained_at
    _model = pipeline
    _trained_at = trained_at
    return pipeline
