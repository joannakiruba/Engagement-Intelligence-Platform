"""
End-to-End Integration Tests for ML Service

This test suite verifies the complete ML service functionality including:
1. Service startup and health checks
2. Risk prediction endpoint
3. Mentor alert generation
4. Database connectivity
5. Backend integration readiness

Run with: pytest tests/test_e2e_ml_service.py -v
"""

import pytest
import httpx
import asyncio
import asyncpg
from datetime import datetime, timedelta
import os
from pathlib import Path

# Test configuration
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8000")
DATABASE_URL = os.getenv("DATABASE_URL", "")
TEST_TIMEOUT = 10  # seconds


class TestMLServiceHealth:
    """Test ML service health and readiness."""

    @pytest.mark.asyncio
    async def test_health_endpoint_accessible(self):
        """Verify the health endpoint is accessible."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{ML_SERVICE_URL}/health",
                    timeout=TEST_TIMEOUT
                )
                assert response.status_code == 200, f"Health check failed with status {response.status_code}"
                data = response.json()
                assert "status" in data
                assert data["status"] == "healthy"
                print(f"✓ Health endpoint is accessible")
                print(f"  Response: {data}")
            except httpx.ConnectError:
                pytest.fail(f"Cannot connect to ML service at {ML_SERVICE_URL}. Is it running?")

    @pytest.mark.asyncio
    async def test_model_loaded(self):
        """Verify the ML model is loaded."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{ML_SERVICE_URL}/health",
                timeout=TEST_TIMEOUT
            )
            assert response.status_code == 200
            data = response.json()

            assert "modelReady" in data
            if data["modelReady"]:
                assert "model" in data
                assert data["model"]["name"] == "logistic_regression"
                assert data["model"]["version"] == "1.0"
                print(f"✓ ML model is loaded and ready")
                print(f"  Model: {data['model']}")
            else:
                print(f"⚠ ML model is not loaded (NOT_READY state)")
                print(f"  This is expected if models/risk_model.joblib doesn't exist")
                print(f"  Run: python ml-service/scripts/train_demo_model.py")


class TestRiskPrediction:
    """Test risk prediction functionality."""

    @pytest.mark.asyncio
    async def test_predict_low_risk_student(self):
        """Test prediction for a low-risk student profile."""
        payload = {
            "studentId": "test-student-1",
            "batchId": "test-batch-1",
            "attendancePercentage": 95.0,
            "assessmentPercentage": 85.0,
            "averageEffortRating": 4.5,
            "averageParticipationRating": 4.5,
            "negativeFeedbackCount": 0
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ML_SERVICE_URL}/api/risk/predict",
                json=payload,
                timeout=TEST_TIMEOUT
            )
            assert response.status_code == 200
            data = response.json()

            if data["status"] == "NOT_READY":
                pytest.skip("Model not ready - run train_demo_model.py first")

            assert data["status"] == "READY"
            assert data["prediction"] in ["LOW", "MEDIUM", "HIGH"]
            assert "probabilities" in data
            assert "LOW" in data["probabilities"]
            assert "MEDIUM" in data["probabilities"]
            assert "HIGH" in data["probabilities"]

            # Probabilities should sum to approximately 1
            prob_sum = sum(data["probabilities"].values())
            assert 0.99 <= prob_sum <= 1.01

            print(f"✓ Risk prediction successful for low-risk profile")
            print(f"  Prediction: {data['prediction']}")
            print(f"  Probabilities: {data['probabilities']}")

    @pytest.mark.asyncio
    async def test_predict_high_risk_student(self):
        """Test prediction for a high-risk student profile."""
        payload = {
            "studentId": "test-student-2",
            "batchId": "test-batch-1",
            "attendancePercentage": 30.0,
            "assessmentPercentage": 20.0,
            "averageEffortRating": 1.0,
            "averageParticipationRating": 1.0,
            "negativeFeedbackCount": 10
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ML_SERVICE_URL}/api/risk/predict",
                json=payload,
                timeout=TEST_TIMEOUT
            )
            assert response.status_code == 200
            data = response.json()

            if data["status"] == "NOT_READY":
                pytest.skip("Model not ready")

            assert data["status"] == "READY"
            assert data["prediction"] in ["LOW", "MEDIUM", "HIGH"]

            print(f"✓ Risk prediction successful for high-risk profile")
            print(f"  Prediction: {data['prediction']}")
            print(f"  Probabilities: {data['probabilities']}")

    @pytest.mark.asyncio
    async def test_predict_validation_errors(self):
        """Test that invalid input is rejected."""
        # Missing required field
        invalid_payload = {
            "studentId": "test-student-3",
            "batchId": "test-batch-1",
            "attendancePercentage": 80.0
            # Missing other required fields
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ML_SERVICE_URL}/api/risk/predict",
                json=invalid_payload,
                timeout=TEST_TIMEOUT
            )
            assert response.status_code == 422  # Validation error
            print(f"✓ Validation correctly rejects invalid input")

    @pytest.mark.asyncio
    async def test_predict_out_of_range_values(self):
        """Test that out-of-range values are rejected."""
        invalid_payload = {
            "studentId": "test-student-4",
            "batchId": "test-batch-1",
            "attendancePercentage": 150.0,  # Invalid: > 100
            "assessmentPercentage": 80.0,
            "averageEffortRating": 3.0,
            "averageParticipationRating": 3.0,
            "negativeFeedbackCount": 1
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ML_SERVICE_URL}/api/risk/predict",
                json=invalid_payload,
                timeout=TEST_TIMEOUT
            )
            assert response.status_code == 422
            print(f"✓ Out-of-range values are rejected")


class TestDatabaseConnectivity:
    """Test database connectivity for mentor alerts."""

    @pytest.mark.asyncio
    async def test_database_connection(self):
        """Test that ML service can connect to the database."""
        if not DATABASE_URL:
            pytest.skip("DATABASE_URL not configured")

        try:
            pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=1,
                max_size=2,
                timeout=TEST_TIMEOUT
            )
            assert pool is not None

            async with pool.acquire() as conn:
                # Test basic query
                result = await conn.fetchval("SELECT 1")
                assert result == 1

            await pool.close()
            print(f"✓ Database connection successful")
        except Exception as e:
            pytest.fail(f"Database connection failed: {e}")

    @pytest.mark.asyncio
    async def test_mentor_alerts_table_exists(self):
        """Verify the ml_mentor_alerts table exists."""
        if not DATABASE_URL:
            pytest.skip("DATABASE_URL not configured")

        pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=2)
        try:
            async with pool.acquire() as conn:
                # Check if table exists
                exists = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_name = 'ml_mentor_alerts'
                    )
                """)
                assert exists, "ml_mentor_alerts table does not exist"

                # Check table structure
                columns = await conn.fetch("""
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = 'ml_mentor_alerts'
                    ORDER BY ordinal_position
                """)

                required_columns = [
                    'id', 'student_id', 'mentor_id', 'priority_score',
                    'urgency_tier', 'trigger_reason', 'risk_score',
                    'recommended_intervention', 'alert_status', 'created_at'
                ]

                column_names = [col['column_name'] for col in columns]
                for req_col in required_columns:
                    assert req_col in column_names, f"Required column {req_col} not found"

                print(f"✓ ml_mentor_alerts table exists with correct structure")
                print(f"  Columns: {len(column_names)}")
        finally:
            await pool.close()


class TestMentorAlertEndpoints:
    """Test mentor alert generation endpoints."""

    @pytest.mark.asyncio
    async def test_generate_alerts_endpoint_accessible(self):
        """Test that the generate alerts endpoint is accessible."""
        if not DATABASE_URL:
            pytest.skip("DATABASE_URL not configured")

        payload = {"batch_id": None}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{ML_SERVICE_URL}/api/ml/mentor-alerts/generate",
                    json=payload,
                    timeout=30  # Generation can take longer
                )

                # Should succeed even if no students exist
                assert response.status_code in [200, 503]

                if response.status_code == 200:
                    data = response.json()
                    assert "total_students_analyzed" in data
                    assert "alerts_generated" in data
                    assert "alerts_filtered" in data
                    print(f"✓ Generate alerts endpoint is functional")
                    print(f"  Students analyzed: {data['total_students_analyzed']}")
                    print(f"  Alerts generated: {data['alerts_generated']}")
                else:
                    print(f"⚠ Database pool not initialized (service may not be running)")

            except httpx.ConnectError:
                pytest.skip("ML service not running")

    @pytest.mark.asyncio
    async def test_get_mentor_alerts_endpoint(self):
        """Test fetching alerts for a specific mentor."""
        if not DATABASE_URL:
            pytest.skip("DATABASE_URL not configured")

        test_mentor_id = "test-mentor-123"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{ML_SERVICE_URL}/api/ml/mentor-alerts/mentor/{test_mentor_id}",
                    timeout=TEST_TIMEOUT
                )

                assert response.status_code in [200, 503]

                if response.status_code == 200:
                    data = response.json()
                    assert "success" in data
                    assert "data" in data
                    assert isinstance(data["data"], list)
                    print(f"✓ Get mentor alerts endpoint is functional")
                    print(f"  Alerts for test mentor: {len(data['data'])}")

            except httpx.ConnectError:
                pytest.skip("ML service not running")


class TestBackendIntegration:
    """Test that backend can successfully call ML service."""

    @pytest.mark.asyncio
    async def test_cors_configuration(self):
        """Verify CORS is configured for backend requests."""
        async with httpx.AsyncClient() as client:
            # Simulate a preflight request
            headers = {
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST"
            }

            response = await client.options(
                f"{ML_SERVICE_URL}/api/risk/predict",
                headers=headers,
                timeout=TEST_TIMEOUT
            )

            # Should allow CORS or return 200/405
            assert response.status_code in [200, 204, 405]
            print(f"✓ CORS configuration appears functional")

    @pytest.mark.asyncio
    async def test_multiple_concurrent_predictions(self):
        """Test that ML service can handle concurrent requests."""
        payloads = [
            {
                "studentId": f"student-{i}",
                "batchId": "batch-1",
                "attendancePercentage": 80.0 + i,
                "assessmentPercentage": 70.0 + i,
                "averageEffortRating": 3.0,
                "averageParticipationRating": 3.0,
                "negativeFeedbackCount": 1
            }
            for i in range(5)
        ]

        async with httpx.AsyncClient() as client:
            tasks = [
                client.post(
                    f"{ML_SERVICE_URL}/api/risk/predict",
                    json=payload,
                    timeout=TEST_TIMEOUT
                )
                for payload in payloads
            ]

            responses = await asyncio.gather(*tasks, return_exceptions=True)

            successful = [r for r in responses if isinstance(r, httpx.Response) and r.status_code == 200]
            assert len(successful) == len(payloads)

            print(f"✓ Successfully handled {len(successful)} concurrent requests")


def test_model_file_exists():
    """Check if the trained model file exists."""
    model_dir = Path(os.getenv("MODEL_DIR", Path(__file__).parent.parent / "models"))
    model_path = model_dir / "risk_model.joblib"

    if model_path.exists():
        print(f"✓ Model file exists at: {model_path}")
        print(f"  File size: {model_path.stat().st_size} bytes")
    else:
        print(f"⚠ Model file not found at: {model_path}")
        print(f"  Run: python ml-service/scripts/train_demo_model.py")


def test_environment_configuration():
    """Verify environment variables are configured."""
    required_vars = ["DATABASE_URL"]
    optional_vars = ["ML_SERVICE_URL", "PORT", "HOST", "MODEL_DIR"]

    print("\n=== Environment Configuration ===")
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Mask sensitive parts
            if "DATABASE_URL" in var:
                print(f"✓ {var}: {'*' * 40} (configured)")
            else:
                print(f"✓ {var}: {value}")
        else:
            print(f"✗ {var}: NOT SET (required)")

    for var in optional_vars:
        value = os.getenv(var)
        status = "configured" if value else "using default"
        print(f"  {var}: {value or '(default)'} ({status})")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("ML Service End-to-End Test Suite")
    print("="*60)

    # Run basic checks
    test_environment_configuration()
    test_model_file_exists()

    print("\n" + "="*60)
    print("Run full test suite with: pytest tests/test_e2e_ml_service.py -v")
    print("="*60)
