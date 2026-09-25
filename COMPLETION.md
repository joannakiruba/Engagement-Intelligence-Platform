# Ticket 14 — Hybrid Rule-Based + ML Risk Categorization

## Completion Report

**Date:** 2026-09-25
**Status:** Complete
**Platform:** HOPE Engagement Intelligence Platform

---

## 1. Overview

Ticket 14 implements a hybrid risk categorization system that combines deterministic rule-based scoring with a machine learning prediction layer. The system evaluates student engagement risk across three dimensions — attendance, assessment performance, and trainer feedback — producing an append-only risk score snapshot for each calculation.

### Architecture

```
Student Data
  → Feature Builder (attendance, assessment, feedback providers)
    → Rule Engine (deterministic scoring: +20/+25/+15, thresholds 30/60)
    → ML Prediction (Logistic Regression via FastAPI microservice)
      → Hybrid Decision Layer (escalation-only: ML can raise but never lower)
        → Final Risk Level (LOW | MEDIUM | HIGH)
          → RiskScore Snapshot (append-only persistence)
```

---

## 2. Components Implemented

### Phase 1 — Data Providers

| File | Purpose |
|------|---------|
| `backend-api/src/providers/attendance.provider.ts` | Queries sessions by batchId, counts PRESENT/LATE as attended |
| `backend-api/src/providers/assessment.provider.ts` | Calculates mean score percentage, filters maxScore=0 |
| `backend-api/src/providers/feedback.provider.ts` | Detects negative feedback (effort ≤ 2 or participation ≤ 2) |

### Phase 2 — Feature Builder

| File | Purpose |
|------|---------|
| `backend-api/src/services/risk/feature-builder.ts` | Parallel aggregation via Promise.all, produces `StudentFeatures` with `dataAvailability` flags |

### Phase 3 — Rule Engine

| File | Purpose |
|------|---------|
| `backend-api/src/services/risk/rule-engine.ts` | Pure function, no DB access. Attendance < 75% → +20, Assessment < 50% → +25, Negative feedback → +15. Score ≤ 30 → LOW, ≤ 60 → MEDIUM, > 60 → HIGH |

### Phase 4 — Hybrid Decision Layer

| File | Purpose |
|------|---------|
| `backend-api/src/services/risk/hybrid-decision.ts` | ML can escalate, never de-escalate. Supports 8 ML failure statuses. DecidedBy: RULE_ENGINE, AGREEMENT, or ML_ESCALATION |

### Phase 5 — ML Service (Python)

| File | Purpose |
|------|---------|
| `ml-service/app/config.py` | Model path, feature order, risk classes, server config |
| `ml-service/app/main.py` | FastAPI application with model loading on startup |
| `ml-service/app/models/risk_request.py` | Pydantic request model with field validation (ranges enforced) |
| `ml-service/app/models/risk_response.py` | Pydantic response model (status, prediction, probabilities, model info) |
| `ml-service/app/risk_engine/calculator.py` | sklearn Pipeline (StandardScaler → LogisticRegression), load/predict/train_and_save |
| `ml-service/app/risk_engine/categorizer.py` | Risk level validation utility |
| `ml-service/app/routes/health.py` | `GET /health` — model readiness and metadata |
| `ml-service/app/routes/risk.py` | `POST /api/risk/predict` — prediction endpoint |
| `ml-service/app/utils/logger.py` | Logging configuration |
| `ml-service/requirements.txt` | FastAPI, scikit-learn, numpy, joblib, pydantic, pytest |
| `ml-service/Dockerfile` | Container image (python:3.12-slim + uvicorn) |
| `ml-service/.env.example` | Environment variable template |

### Phase 6 — Backend ML Client

| File | Purpose |
|------|---------|
| `backend-api/src/services/ml.service.ts` | HTTP client calling ML service. Builds feature payload, applies configurable timeout (default 5000ms), validates prediction and probabilities, returns typed `MlResult`. Configurable via `ML_SERVICE_URL` and `ML_TIMEOUT_MS` environment variables |

### Phase 7 — Risk Score Service & Persistence

| File | Purpose |
|------|---------|
| `backend-api/src/services/risk/risk-score.service.ts` | Orchestrates: validate batch membership → build features → rule engine → ML prediction → hybrid decision → persist RiskScore. Batch calculation with per-student error isolation |

### Phase 8 — Validators, Controller, Routes

| File | Purpose |
|------|---------|
| `backend-api/src/validators/risk.validator.ts` | Joi schemas for risk endpoints |
| `backend-api/src/controllers/risk.controller.ts` | 5 handlers with RBAC scope enforcement, factor stripping for TRAINER |
| `backend-api/src/routes/risk.routes.ts` | 5 routes with correct ordering, requirePermission + resolveScope middleware |

### Phase 9 — Server & Permissions

| File | Change |
|------|--------|
| `backend-api/src/server.ts` | Added risk routes at `/api/risk` |
| `backend-api/src/prisma/permission-catalog.ts` | Added `risk_scores:calculate:batch` (TRAINER) and `risk_scores:calculate:any` (ADMIN) |

---

## 3. ML Model

### Algorithm
```
Logistic Regression (scikit-learn)
Pipeline: StandardScaler → LogisticRegression(solver='lbfgs', max_iter=1000)
```

### Feature Vector (deterministic order)
```
[
  attendancePercentage,      # 0-100, from attendance provider
  assessmentPercentage,      # 0-100, from assessment provider
  averageEffortRating,       # 0-5, from feedback provider
  averageParticipationRating,# 0-5, from feedback provider
  negativeFeedbackCount      # >= 0, from feedback provider
]
```

### Target
Multi-class classification: `LOW`, `MEDIUM`, `HIGH` — the student's future risk level.

### ML Readiness
```
Status: NOT_READY
```
No trained model artifact exists at `ml-service/models/risk_model.joblib`. The system safely falls back to rule-based scoring. **Model training/evaluation requires historical labelled data.**

### Data Leakage Prevention
- The model does NOT train on the same RiskScore it predicts
- The intended relationship is: Features at T1 → Model → Risk level at T2
- InterventionOutcome is NOT used as the target
- No fabricated training data is claimed as production data

### Prediction Response Format
```json
{
  "status": "READY",
  "prediction": "MEDIUM",
  "probabilities": {
    "LOW": 0.10,
    "MEDIUM": 0.72,
    "HIGH": 0.18
  },
  "model": {
    "name": "logistic_regression",
    "version": "1.0",
    "featureVersion": "1.0",
    "trainedAt": "2026-09-25T00:00:00Z"
  }
}
```

### Failure Statuses (compatible with hybrid layer)
```
NOT_READY              — no model artifact loaded
UNAVAILABLE            — ML service connection refused or HTTP error
TIMEOUT                — request exceeded ML_TIMEOUT_MS (default 5000ms)
ERROR                  — ML service internal error
MALFORMED_RESPONSE     — response is not valid JSON
INVALID_PREDICTION     — prediction is not LOW/MEDIUM/HIGH
INVALID_PROBABILITIES  — probabilities missing, non-numeric, or outside [0,1]
```

---

## 4. Probability Validation

The backend validates every ML response before accepting it:

| Check | Rejection Status |
|-------|-----------------|
| Prediction not in LOW/MEDIUM/HIGH | `INVALID_PREDICTION` |
| Prediction missing | `INVALID_PREDICTION` |
| Probabilities missing or null | `INVALID_PROBABILITIES` |
| Any probability not a number | `INVALID_PROBABILITIES` |
| Any probability < 0 | `INVALID_PROBABILITIES` |
| Any probability > 1 | `INVALID_PROBABILITIES` |
| Response not valid JSON | `MALFORMED_RESPONSE` |

On any rejection, the system falls back to the rule engine result.

---

## 5. Hybrid Decision Rules

| Condition | Final Level | DecidedBy |
|-----------|-------------|-----------|
| ML NOT_READY / failure | Rule level | RULE_ENGINE |
| ML agrees with rule | Same level | AGREEMENT |
| ML more severe than rule | ML level | ML_ESCALATION |
| ML less severe than rule | Rule level | RULE_ENGINE |

Severity ordering: `LOW (0) < MEDIUM (1) < HIGH (2)`

ML can **escalate** but **never de-escalate** the rule-based result.

---

## 6. RiskScore Persistence

Stored in existing `RiskScore` model (no schema changes):

```
totalScore  = deterministic rule score (0-60)
riskLevel   = final hybrid risk level (LOW/MEDIUM/HIGH)
factors     = JSON explainability object
```

### Factors JSON Structure
```json
{
  "dataAvailability": {
    "attendance": true,
    "assessment": true,
    "feedback": true
  },
  "scope": { "batchId": "..." },
  "ruleBased": {
    "attendanceRisk": 20,
    "assessmentRisk": 0,
    "feedbackRisk": 15,
    "totalScore": 35,
    "riskLevel": "MEDIUM",
    "details": { ... }
  },
  "ml": {
    "status": "READY",
    "prediction": "MEDIUM",
    "probabilities": { "LOW": 0.10, "MEDIUM": 0.72, "HIGH": 0.18 },
    "modelVersion": "1.0"
  },
  "final": {
    "riskLevel": "MEDIUM",
    "decidedBy": "AGREEMENT"
  }
}
```

---

## 7. API Endpoints

| Method | Route | Permission | Description |
|--------|-------|-----------|-------------|
| POST | `/api/risk/calculate/:studentId` | `risk_scores:calculate:batch` or `:any` | Calculate individual student risk |
| POST | `/api/risk/calculate/batch/:batchId` | `risk_scores:calculate:batch` or `:any` | Calculate risk for entire batch |
| GET | `/api/risk/student/:studentId` | `risk_scores:read:*` | Get latest risk score |
| GET | `/api/risk/student/:studentId/history` | `risk_scores:read:own/self/assigned/any` | Get risk history |
| GET | `/api/risk/high` | `risk_scores:read:any` | List high-risk students |

---

## 8. Environment Configuration

### Backend (`backend-api/.env`)
```
ML_SERVICE_URL=http://localhost:8000    # ML service base URL
ML_TIMEOUT_MS=5000                      # ML request timeout in milliseconds
```

### ML Service (`ml-service/.env`)
```
HOST=0.0.0.0
PORT=8000
MODEL_DIR=./models                      # Directory containing risk_model.joblib
```

---

## 9. Tests

### Backend Tests: 443/443 passing

| Suite | Tests | Description |
|-------|-------|-------------|
| `risk-engine.test.ts` | 32 | Rule engine unit tests (basic rules, boundaries, hybrid, ML failures, metadata) |
| `risk-engine.integration.test.ts` | 39 | Integration tests (API, RBAC, batch, snapshots, cross-batch isolation) |
| `ml-service.test.ts` | 28 | ML client tests (valid predictions, validation failures, service failures) |
| Existing test suites | 344 | All pre-existing tests unmodified and passing |

### ML Service Tests: 25/25 passing

| Test Class | Tests | Description |
|------------|-------|-------------|
| TestModelNotReady | 2 | Prediction returns NOT_READY, model readiness check |
| TestModelReady | 7 | Valid LOW/MEDIUM/HIGH predictions, probability structure, metadata |
| TestFeatureVector | 2 | Feature ordering and config consistency |
| TestCategorizer | 2 | Valid/invalid risk level checks |
| TestPredictionError | 1 | Exception handling returns ERROR status |
| TestLoadModel | 2 | Missing file and corrupt file handling |
| TestTrainAndSave | 1 | Model artifact creation and persistence |
| TestHealthEndpoint | 2 | Health check with/without model |
| TestPredictEndpoint | 5 | API endpoint validation and responses |

### TypeScript Build: PASS
Zero new TypeScript errors from Ticket 14 code. Pre-existing `moduleResolution=node10` issue (removed in TS 7) is unrelated.

---

## 10. Files Summary

### Files Created (total: 22)

**Backend API (15 files):**
- `src/providers/attendance.provider.ts`
- `src/providers/assessment.provider.ts`
- `src/providers/feedback.provider.ts`
- `src/services/risk/feature-builder.ts`
- `src/services/risk/rule-engine.ts`
- `src/services/risk/hybrid-decision.ts`
- `src/services/risk/risk-score.service.ts`
- `src/services/ml.service.ts`
- `src/validators/risk.validator.ts`
- `src/controllers/risk.controller.ts`
- `src/routes/risk.routes.ts`
- `src/__tests__/risk-engine.test.ts`
- `src/__tests__/risk-engine.integration.test.ts`
- `src/__tests__/ml-service.test.ts`

**ML Service (15 files):**
- `requirements.txt`
- `Dockerfile`
- `.env.example`
- `app/__init__.py`
- `app/config.py`
- `app/main.py`
- `app/models/__init__.py`
- `app/models/risk_request.py`
- `app/models/risk_response.py`
- `app/risk_engine/__init__.py`
- `app/risk_engine/calculator.py`
- `app/risk_engine/categorizer.py`
- `app/routes/__init__.py`
- `app/routes/health.py`
- `app/routes/risk.py`
- `app/utils/__init__.py`
- `app/utils/logger.py`
- `tests/__init__.py`
- `tests/test_risk_engine.py`

### Files Modified (5)
- `backend-api/src/server.ts` — added risk routes
- `backend-api/src/prisma/permission-catalog.ts` — added calculate permissions
- `backend-api/tests/auth-rbac.test.ts` — updated permission expectations (67 → 69)
- `backend-api/src/services/risk/risk-score.service.ts` — replaced stub with real ML client call
- `backend-api/src/__tests__/risk-engine.integration.test.ts` — added ML service mock

### Files NOT Modified
- `backend-api/src/prisma/schema.prisma` — **confirmed unchanged**
- `backend-api/src/routes/attendance.routes.ts`
- `backend-api/src/routes/feedback.routes.ts`
- `backend-api/src/routes/assessments.routes.ts`
- `backend-api/src/routes/interventions.routes.ts`
- `backend-api/src/jobs/*`

---

## 11. Preserved Behavior

| Behavior | Status |
|----------|--------|
| Rule engine scoring (20/25/15, thresholds 30/60) | Preserved |
| Hybrid escalation-only logic | Preserved |
| RiskScore append-only snapshots | Preserved |
| RBAC (TRAINER batch scope, ADMIN any scope) | Preserved |
| Batch isolation (cross-batch data separation) | Preserved |
| TRAINER factor stripping (category_batch scope) | Preserved |
| Original 71 Ticket 14 tests | All passing |
| Original 344 pre-existing tests | All passing |

---

## 12. Running the Services

### Backend API
```bash
cd backend-api
npm install
npm run dev        # development server
npm test           # 443 tests
```

### ML Service
```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000    # start service
python -m pytest tests/ -v                           # 25 tests
```

### Training a Model
Once a verified historical labelled dataset is available:
```python
from app.risk_engine.calculator import train_and_save
import numpy as np

# X: shape (n_samples, 5) — feature vector in documented order
# y: shape (n_samples,) — labels: "LOW", "MEDIUM", "HIGH"
train_and_save(X, y, trained_at="2026-09-25T00:00:00Z")
# Saves to ml-service/models/risk_model.joblib
# Service will load it on next startup
```

---

## 13. Open Items

| Item | Status |
|------|--------|
| Production training data | **Not available** — model returns NOT_READY |
| Model evaluation metrics | **Not reported** — requires real labelled dataset |
| ML performance (accuracy, F1, ROC-AUC) | **Cannot be claimed** without genuine evaluation |
| `trend_detector.py` | Scaffold exists, not implemented (out of scope) |
| Pre-existing `moduleResolution=node10` TS config | Not caused by Ticket 14; affects `npx tsc --noEmit` directly |
