import numpy as np
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.risk_engine.calculator import (
    create_pipeline,
    predict,
    build_feature_vector,
    train_and_save,
    is_model_ready,
    get_model_metadata,
    load_model,
)
from app.risk_engine import calculator as calc_module
from app.risk_engine.categorizer import is_valid_risk_level
from app.config import FEATURE_ORDER, RISK_CLASSES
from app.main import app

client = TestClient(app)

# --- Test data (synthetic, for unit testing only — NOT production data) ---
SYNTHETIC_X = np.array([
    [90.0, 80.0, 4.0, 4.0, 0],   # LOW
    [85.0, 70.0, 3.5, 3.5, 1],   # LOW
    [60.0, 45.0, 2.5, 2.5, 3],   # MEDIUM
    [55.0, 40.0, 2.0, 2.0, 4],   # MEDIUM
    [30.0, 20.0, 1.0, 1.0, 8],   # HIGH
    [25.0, 15.0, 1.5, 1.0, 10],  # HIGH
    [95.0, 90.0, 5.0, 5.0, 0],   # LOW
    [50.0, 35.0, 2.0, 2.5, 5],   # MEDIUM
    [20.0, 10.0, 1.0, 1.0, 12],  # HIGH
    [80.0, 75.0, 3.0, 3.0, 0],   # LOW
    [70.0, 48.0, 2.5, 2.0, 3],   # MEDIUM
    [35.0, 25.0, 1.5, 1.5, 7],   # HIGH
])
SYNTHETIC_Y = np.array([
    "LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH",
    "LOW", "MEDIUM", "HIGH", "LOW", "MEDIUM", "HIGH",
])


def _train_test_model():
    """Train a model on synthetic data for testing purposes only."""
    calc_module._model = None
    calc_module._trained_at = None
    pipeline = create_pipeline()
    pipeline.fit(SYNTHETIC_X, SYNTHETIC_Y)
    calc_module._model = pipeline
    calc_module._trained_at = "2026-09-25T00:00:00Z"


def _clear_model():
    calc_module._model = None
    calc_module._trained_at = None


# =========================================================================
# Calculator unit tests
# =========================================================================

class TestModelNotReady:
    def setup_method(self):
        _clear_model()

    def test_predict_returns_not_ready(self):
        result = predict({"attendancePercentage": 80, "assessmentPercentage": 70,
                          "averageEffortRating": 3, "averageParticipationRating": 3,
                          "negativeFeedbackCount": 0})
        assert result["status"] == "NOT_READY"

    def test_is_model_ready_false(self):
        assert is_model_ready() is False


class TestModelReady:
    def setup_method(self):
        _train_test_model()

    def teardown_method(self):
        _clear_model()

    def test_is_model_ready_true(self):
        assert is_model_ready() is True

    def test_valid_low_prediction(self):
        result = predict({"attendancePercentage": 95, "assessmentPercentage": 90,
                          "averageEffortRating": 4.5, "averageParticipationRating": 4.5,
                          "negativeFeedbackCount": 0})
        assert result["status"] == "READY"
        assert result["prediction"] == "LOW"
        assert "probabilities" in result
        assert "model" in result

    def test_valid_medium_prediction(self):
        result = predict({"attendancePercentage": 55, "assessmentPercentage": 40,
                          "averageEffortRating": 2.0, "averageParticipationRating": 2.0,
                          "negativeFeedbackCount": 4})
        assert result["status"] == "READY"
        assert result["prediction"] == "MEDIUM"

    def test_valid_high_prediction(self):
        result = predict({"attendancePercentage": 20, "assessmentPercentage": 10,
                          "averageEffortRating": 1.0, "averageParticipationRating": 1.0,
                          "negativeFeedbackCount": 12})
        assert result["status"] == "READY"
        assert result["prediction"] == "HIGH"

    def test_probability_response_structure(self):
        result = predict({"attendancePercentage": 80, "assessmentPercentage": 70,
                          "averageEffortRating": 3.0, "averageParticipationRating": 3.0,
                          "negativeFeedbackCount": 1})
        assert result["status"] == "READY"
        probs = result["probabilities"]
        assert "LOW" in probs
        assert "MEDIUM" in probs
        assert "HIGH" in probs
        for v in probs.values():
            assert 0.0 <= v <= 1.0
        assert abs(sum(probs.values()) - 1.0) < 0.01

    def test_model_metadata_in_response(self):
        result = predict({"attendancePercentage": 80, "assessmentPercentage": 70,
                          "averageEffortRating": 3, "averageParticipationRating": 3,
                          "negativeFeedbackCount": 0})
        assert result["model"]["name"] == "logistic_regression"
        assert result["model"]["version"] == "1.0"
        assert result["model"]["featureVersion"] == "1.0"
        assert result["model"]["trainedAt"] == "2026-09-25T00:00:00Z"

    def test_prediction_is_valid_class(self):
        result = predict({"attendancePercentage": 50, "assessmentPercentage": 50,
                          "averageEffortRating": 3, "averageParticipationRating": 3,
                          "negativeFeedbackCount": 2})
        assert result["prediction"] in RISK_CLASSES

    def test_get_model_metadata(self):
        meta = get_model_metadata()
        assert meta["name"] == "logistic_regression"
        assert meta["version"] == "1.0"
        assert meta["featureVersion"] == "1.0"


class TestFeatureVector:
    def test_build_feature_vector_order(self):
        features = {
            "negativeFeedbackCount": 5,
            "averageParticipationRating": 2.0,
            "attendancePercentage": 60.0,
            "assessmentPercentage": 45.0,
            "averageEffortRating": 2.5,
        }
        vec = build_feature_vector(features)
        assert vec.shape == (1, 5)
        assert vec[0][0] == 60.0   # attendancePercentage
        assert vec[0][1] == 45.0   # assessmentPercentage
        assert vec[0][2] == 2.5    # averageEffortRating
        assert vec[0][3] == 2.0    # averageParticipationRating
        assert vec[0][4] == 5      # negativeFeedbackCount

    def test_feature_order_matches_config(self):
        assert FEATURE_ORDER == [
            "attendancePercentage",
            "assessmentPercentage",
            "averageEffortRating",
            "averageParticipationRating",
            "negativeFeedbackCount",
        ]


class TestCategorizer:
    def test_valid_risk_levels(self):
        assert is_valid_risk_level("LOW") is True
        assert is_valid_risk_level("MEDIUM") is True
        assert is_valid_risk_level("HIGH") is True

    def test_invalid_risk_level(self):
        assert is_valid_risk_level("CRITICAL") is False
        assert is_valid_risk_level("low") is False
        assert is_valid_risk_level("") is False


class TestPredictionError:
    def setup_method(self):
        _train_test_model()

    def teardown_method(self):
        _clear_model()

    def test_prediction_exception_returns_error(self):
        original = calc_module._model
        calc_module._model = MagicMock()
        calc_module._model.predict.side_effect = RuntimeError("model exploded")
        result = predict({"attendancePercentage": 80, "assessmentPercentage": 70,
                          "averageEffortRating": 3, "averageParticipationRating": 3,
                          "negativeFeedbackCount": 0})
        assert result["status"] == "ERROR"
        calc_module._model = original


class TestLoadModel:
    def test_load_model_no_file(self, tmp_path):
        with patch("app.risk_engine.calculator.MODEL_PATH", tmp_path / "nonexistent.joblib"):
            result = load_model()
            assert result is False
            assert is_model_ready() is False

    def test_load_model_corrupt_file(self, tmp_path):
        bad_file = tmp_path / "bad_model.joblib"
        bad_file.write_text("not a valid joblib file")
        with patch("app.risk_engine.calculator.MODEL_PATH", bad_file):
            result = load_model()
            assert result is False
            assert is_model_ready() is False


class TestTrainAndSave:
    def teardown_method(self):
        _clear_model()

    def test_train_and_save_creates_artifact(self, tmp_path):
        model_path = tmp_path / "risk_model.joblib"
        with patch("app.risk_engine.calculator.MODEL_PATH", model_path):
            pipeline = train_and_save(SYNTHETIC_X, SYNTHETIC_Y, "2026-09-25T00:00:00Z")
            assert model_path.exists()
            assert is_model_ready()
            prediction = pipeline.predict(SYNTHETIC_X[:1])[0]
            assert prediction in RISK_CLASSES


# =========================================================================
# FastAPI endpoint tests
# =========================================================================

class TestHealthEndpoint:
    def setup_method(self):
        _clear_model()

    def test_health_model_not_ready(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["modelReady"] is False

    def test_health_model_ready(self):
        _train_test_model()
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["modelReady"] is True
        assert data["model"]["name"] == "logistic_regression"
        _clear_model()


class TestPredictEndpoint:
    def setup_method(self):
        _train_test_model()

    def teardown_method(self):
        _clear_model()

    def test_predict_returns_valid_response(self):
        response = client.post("/api/risk/predict", json={
            "studentId": "student-1",
            "batchId": "batch-1",
            "attendancePercentage": 80,
            "assessmentPercentage": 70,
            "averageEffortRating": 3.0,
            "averageParticipationRating": 3.0,
            "negativeFeedbackCount": 1,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "READY"
        assert data["prediction"] in RISK_CLASSES
        assert "probabilities" in data

    def test_predict_not_ready_without_model(self):
        _clear_model()
        response = client.post("/api/risk/predict", json={
            "studentId": "student-1",
            "batchId": "batch-1",
            "attendancePercentage": 80,
            "assessmentPercentage": 70,
            "averageEffortRating": 3.0,
            "averageParticipationRating": 3.0,
            "negativeFeedbackCount": 1,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "NOT_READY"

    def test_predict_invalid_request_missing_field(self):
        response = client.post("/api/risk/predict", json={
            "studentId": "student-1",
            "batchId": "batch-1",
        })
        assert response.status_code == 422

    def test_predict_invalid_attendance_range(self):
        response = client.post("/api/risk/predict", json={
            "studentId": "student-1",
            "batchId": "batch-1",
            "attendancePercentage": 150,
            "assessmentPercentage": 70,
            "averageEffortRating": 3.0,
            "averageParticipationRating": 3.0,
            "negativeFeedbackCount": 1,
        })
        assert response.status_code == 422

    def test_predict_negative_feedback_count(self):
        response = client.post("/api/risk/predict", json={
            "studentId": "student-1",
            "batchId": "batch-1",
            "attendancePercentage": 80,
            "assessmentPercentage": 70,
            "averageEffortRating": 3.0,
            "averageParticipationRating": 3.0,
            "negativeFeedbackCount": -1,
        })
        assert response.status_code == 422
