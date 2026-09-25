# Ticket 14 — Hybrid Rule-Based + ML Risk Categorization

## Implementation Blueprint

---

## 1. Repository Inspection Findings

### 1.1 Backend Technology

| Component | Detail |
|-----------|--------|
| Runtime | Node.js 20+ with Express 5.2.1 |
| Language | TypeScript 7 (compiled via SWC) |
| ORM | Prisma 6.19.3 with PostgreSQL |
| Validation | Joi 17.13.3 |
| Auth | JWT via `authenticateJwt` middleware |
| RBAC | `requirePermission()` + `resolveScope()` middleware chain |
| Response format | `{ success: true, data }` / `{ success: false, error }` via `utils/response.ts` |
| Error handling | `ServiceError` class (per-service) + global `errorHandler` middleware |
| Test framework | Jest 30 + Supertest, SWC transform |
| Prisma singleton | `lib/prisma.ts` exports `new PrismaClient()` |
| Logging | Winston logger (`utils/logger.ts`) — JSON format, `defaultMeta: { service: 'hope-api' }` |

### 1.2 Code Patterns in Use

**Two coexisting route patterns:**

**Pattern A — "Fat route" (attendance, feedback, sessions):**
Joi schemas, Prisma calls, and response helpers all inline in the route file. No separate controller or service.

```
route file → Joi schema → validate middleware → inline async handler → prisma → sendSuccess/sendError
```

**Pattern B — "Route → Controller → Service" (assessments, batches):**
Route imports validators + controller handlers. Controllers call service functions. Services throw `ServiceError`.

```
route file → validator → controller handler → service function → prisma
                                            ↓ on error
                                      handleServiceError → sendError
```

**Ticket 14 will follow Pattern B** (Route → Controller → Service) because the risk engine has enough business logic to justify a proper service layer.

### 1.3 Route Registration Pattern

In `server.ts`, routes are mounted as:

```ts
app.use('/api/<resource>', authenticateJwt, resourceRoutes);
```

JWT authentication is applied at the mount level. RBAC is applied per-route via `requirePermission()`.

### 1.4 Existing Risk-Related Code

| Item | Location | Status |
|------|----------|--------|
| `RiskScore` model | `prisma/schema.prisma:394-415` | **EXISTS** — has `studentId`, `attendanceRisk`, `assessmentRisk`, `feedbackRisk`, `totalScore`, `riskLevel`, `factors` (Json?) |
| `RiskLevel` enum | `prisma/schema.prisma:30-34` | **EXISTS** — `LOW`, `MEDIUM`, `HIGH` |
| `Intervention` → `RiskScore` relation | `prisma/schema.prisma:440` | **EXISTS** — `riskScoreId String?` optional FK |
| `risk_scores:read:*` permissions | `prisma/permission-catalog.ts:113-120` | **EXISTS** — `own`, `category:batch`, `assigned`, `any` |
| `risk.routes.ts` | — | **DOES NOT EXIST** |
| `risk.controller.ts` | — | **DOES NOT EXIST** |
| `risk.service.ts` | — | **DOES NOT EXIST** |
| `ml.service.ts` | `services/ml.service.ts` | **EXISTS but EMPTY** (0 bytes) |

### 1.5 ML Service (Python)

| Item | Status |
|------|--------|
| `ml-service/` directory | **EXISTS** — full directory structure |
| `app/main.py` | **EMPTY** (0 bytes) |
| `app/risk_engine/calculator.py` | **EMPTY** (0 bytes) |
| `app/risk_engine/categorizer.py` | **EMPTY** (0 bytes) |
| `app/risk_engine/trend_detector.py` | **EMPTY** (0 bytes) |
| `app/routes/risk.py` | **EMPTY** (0 bytes) |
| `app/routes/health.py` | **EMPTY** (0 bytes) |
| `app/models/risk_request.py` | **EXISTS** — unknown content |
| `app/models/risk_response.py` | **EXISTS** — unknown content |
| `requirements.txt` | **EMPTY** (0 bytes) |
| `Dockerfile` | **EMPTY** (0 bytes) |

The entire ML service is scaffolded but has zero implementation.

### 1.6 Infrastructure

| Item | Status |
|------|--------|
| `docker-compose.yml` | **EMPTY** |
| `docker-compose.prod.yml` | **EMPTY** |
| `ci.yml` | **EMPTY** |
| BullMQ job files (`queue.ts`, `alert.job.ts`, `weekly-report.job.ts`) | **ALL EMPTY** |
| `email.service.ts` | **EMPTY** |
| `s3.service.ts` | **EMPTY** |

### 1.7 Batch Data Model (Repository-Verified)

The Prisma schema establishes clear batch-scoped data paths:

```
Batch
  ├── members: BatchMember[] (batchId + studentId, unique)
  ├── trainers: BatchTrainer[] (batchId + trainerId, unique)
  ├── sessions: Session[] (Session.batchId → Batch.id)
  │     ├── attendances: Attendance[] (Attendance.sessionId → Session.id)
  │     └── feedbacks: Feedback[] (Feedback.sessionId → Session.id)
  └── assessments: Assessment[] (Assessment.batchId → Batch.id)
        └── results: AssessmentResult[] (AssessmentResult.assessmentId → Assessment.id)
```

All three data sources (Attendance, Assessment, Feedback) trace back to a `Batch` through schema relationships:
- **Attendance** → via `Session.batchId`
- **Assessment/Results** → via `Assessment.batchId`
- **Feedback** → via `Session.batchId`
- **Student membership** → via `BatchMember` (batchId + studentId, unique constraint)

This is the existing schema. Ticket 14 does not modify it.

---

## 2. Module Availability Matrix

### AVAILABLE NOW

| Module | Evidence | What Ticket 14 can use |
|--------|----------|----------------------|
| **Database Schema** (Module 1) | `schema.prisma` — 25+ models, 2 migrations | `RiskScore` model, `RiskLevel` enum, all relation fields |
| **Auth & RBAC** (Module 2) | `auth/jwt.middleware.ts`, `auth/rbac.middleware.ts`, `prisma/permission-catalog.ts` | `authenticateJwt`, `requirePermission()`, `resolveScope()`, `getScopedStudentIds()` |
| **User Management** (Module 3) | `routes/users.routes.ts` | User lookup by ID |
| **Batch & Session Management** (Module 4) | `routes/batches.routes.ts`, `services/batches.service.ts` (447 lines) | Batch membership queries, session counts per student |
| **Assessment & Performance** (Module 6) | `routes/assessments.routes.ts`, `services/assessments.service.ts` (900 lines), `controllers/assessments.controller.ts` | `AssessmentResult` records with `score` per student per assessment, `Assessment.maxScore` |
| **Prisma client singleton** | `lib/prisma.ts` | Direct Prisma queries for all data aggregation |
| **Permission catalog** | `prisma/permission-catalog.ts:113-120` | `risk_scores:read:own`, `risk_scores:read:category:batch`, `risk_scores:read:assigned`, `risk_scores:read:any` — already defined for all 6 roles |

### NOT AVAILABLE YET

| Module | What exists | What Ticket 14 needs from it |
|--------|-------------|------------------------------|
| **Attendance** (Module 5) | Route file exists (`attendance.routes.ts`) with full CRUD. **However:** Attendance data depends on sessions being created and attendance being marked. No guarantee of populated data at runtime. | Attendance records per student to calculate `attendancePercentage` |
| **Trainer Feedback** (Module 8) | Route file exists (`feedback.routes.ts`) with full CRUD. Same caveat: depends on populated data. | Feedback records with `effortRating` and `participationRating` to detect negative feedback |
| **Weekly Risk Report** (Module 13) | `jobs/weekly-report.job.ts` — **EMPTY** | Will consume `RiskScore` records generated by Ticket 14 |
| **Mentor Alert System** (Module 14-alerts) | `jobs/alert.job.ts` — **EMPTY**, `email.service.ts` — **EMPTY** | Will trigger when `riskLevel` transitions to `HIGH` |
| **Intervention Workflow** (Modules 15-16) | `routes/interventions.routes.ts` — **EMPTY**, `Intervention` model exists in schema | Will link to `RiskScore` via `riskScoreId` FK |
| **ML Service** | All Python files — **EMPTY** | Will provide ML predictions in Phase 9-10 |
| **BullMQ / Redis** | `jobs/queue.ts` — **EMPTY** | Could be used for batch risk calculation jobs |

### REQUIRED FOR FUTURE INTEGRATION

| Future module | Integration point | Direction |
|---------------|-------------------|-----------|
| **Weekly Risk Report** (Module 13) | Reads `RiskScore` table | Downstream consumer of Ticket 14 output |
| **Mentor Alert System** | Triggered when `RiskScore.riskLevel = HIGH` | Downstream consumer |
| **Intervention Workflow** | `Intervention.riskScoreId` → `RiskScore.id` | Downstream consumer |
| **Engagement Dashboard** (Modules 10-11) | Reads `RiskScore` for display | Downstream consumer |
| **Training History** (Module 7) | Could provide historical context for ML features | Future ML input |

---

## 3. Architecture

### 3.1 Hybrid System Overview

```
Attendance (Prisma query, batch-scoped)
Assessment (Prisma query, batch-scoped)
Feedback   (Prisma query, batch-scoped)
        |
        v
  Data Providers (batch-scoped)
  (AttendanceProvider, AssessmentProvider, FeedbackProvider)
        |
        v
  Feature Builder
        |
        +-------------------+
        |                   |
        v                   v
  Rule Engine          ML Engine
        |                   |
        +---------+---------+
                  |
                  v
          Hybrid Decision Layer
                  |
                  v
           LOW / MEDIUM / HIGH
                  |
                  v
         RiskScore (Prisma persist)
```

### 3.2 Component Responsibilities

| Component | Responsibility | Owns data? |
|-----------|---------------|------------|
| **AttendanceProvider** | Queries `Attendance` table (batch-scoped via Session), computes attendance percentage for a student | NO — read-only |
| **AssessmentProvider** | Queries `AssessmentResult` + `Assessment` tables (batch-scoped via Assessment.batchId), computes average score percentage | NO — read-only |
| **FeedbackProvider** | Queries `Feedback` table (batch-scoped via Session), detects negative feedback | NO — read-only |
| **FeatureBuilder** | Orchestrates providers with a `batchId`, assembles a typed feature vector for one student | NO — read-only |
| **RuleEngine** | Applies deterministic scoring rules to the feature vector | NO |
| **MLEngine** | Produces a risk prediction from the feature vector (when ready) | NO |
| **HybridDecisionLayer** | Combines rule-based and ML outputs into a final `RiskLevel` | NO |
| **RiskScoreService** | Persists the final `RiskScore` record via Prisma | YES — writes to `risk_scores` table |

### 3.3 Provider Interface Boundaries

Each provider is a standalone module with a clean interface. This allows:
- The risk engine to function even when source data is empty or partially available
- Other teams to develop Attendance/Feedback modules independently
- Unit testing with mock providers without conflating mocks with production code

```ts
// Conceptual interface — each provider accepts batchId for scope and returns a typed result or null
interface AttendanceProvider {
  getAttendanceStats(studentId: string, batchId: string): Promise<AttendanceStats | null>;
}

interface AssessmentProvider {
  getAssessmentStats(studentId: string, batchId: string): Promise<AssessmentStats | null>;
}

interface FeedbackProvider {
  getFeedbackStats(studentId: string, batchId: string): Promise<FeedbackStats | null>;
}
```

**These are NOT mock implementations.** They are Prisma-backed query modules that read from the existing schema tables. If those tables contain no data (because Attendance/Feedback modules haven't populated them yet), the providers return `null` and the rule engine handles the absence gracefully (0 risk points for missing data).

---

## 4. Calculation Scope

### 4.1 Batch Isolation Principle

All risk calculations are **scoped to a specific batch**. Data from unrelated batches must never affect a student's risk score for a given batch.

This is enforced at the provider level using the existing schema relationships documented in Section 1.7.

### 4.2 Per-Source Scoping Rules

| Data source | Scope mechanism | Prisma query path |
|-------------|----------------|-------------------|
| **Attendance** | Only sessions belonging to the target batch | `Attendance WHERE session.batchId = :batchId AND studentId = :studentId` |
| **Assessment** | Only assessments belonging to the target batch | `AssessmentResult WHERE assessment.batchId = :batchId AND studentId = :studentId` |
| **Feedback** | Only feedback from sessions in the target batch | `Feedback WHERE session.batchId = :batchId AND studentId = :studentId` |
| **Students** (batch endpoint) | Only students who are members of the batch | `BatchMember WHERE batchId = :batchId` → list of `studentId` values |

### 4.3 Batch Resolution

**For `POST /api/risk/calculate/batch/:batchId`:**

The `batchId` is provided directly in the URL. All provider queries are scoped to this batch. Only students listed in `BatchMember` for this batch are processed.

**For `POST /api/risk/calculate/:studentId`:**

The request body must include a `batchId` parameter. This is required because a student may belong to multiple batches (the `BatchMember` unique constraint is on `[batchId, studentId]`, not on `studentId` alone). The API must not guess which batch to use.

If the student is not a member of the specified batch (`BatchMember` record does not exist), the endpoint returns 404.

### 4.4 Scope Test Requirement

A dedicated test must verify that attendance, assessment, and feedback data from a different batch does not affect the risk score of a student calculated for a specific batch. See Section 8, Scope Tests.

---

## 5. Rule-Based Risk Engine

### 5.1 Scoring Rules

#### Attendance Risk

| Condition | Points |
|-----------|--------|
| `attendancePercentage < 75` | **+20** |
| `attendancePercentage >= 75` | **0** |
| No attendance data available | **0** |

Calculation: `attendancePercentage = (sessionsAttended / totalBatchSessions) * 100`

**Attendance status semantics — REQUIRES TEAM CONFIRMATION:**

The repository does not contain a written specification for which `AttendanceStatus` values count as "attended." The `AttendanceStatus` enum defines: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`. The attendance route (`attendance.routes.ts`) accepts all four statuses but does not define aggregation rules.

**Proposed default (must be confirmed before implementation):**
- `PRESENT` and `LATE` count as attended (the student was physically present)
- `ABSENT` and `EXCUSED` count as not attended

This is a Ticket 14 proposal, not a verified business rule. The Attendance module owner (Module 5) must confirm or override this before Ticket 14 implementation begins. If the team specifies different semantics, the `AttendanceProvider` must follow them.

Ticket 14 must NOT redefine Attendance business rules. It consumes the data as the owning module defines it.

#### Assessment Risk

| Condition | Points |
|-----------|--------|
| `averageAssessmentScore < 50%` | **+25** |
| `averageAssessmentScore >= 50%` | **0** |
| No assessment data available | **0** |

Calculation: `averageAssessmentScore = mean(score / maxScore * 100)` across all `AssessmentResult` records for the student within the target batch, where `maxScore` comes from the parent `Assessment` record.

Assessments where `maxScore = 0` are excluded from the average to avoid division by zero.

#### Feedback Risk

| Condition | Points |
|-----------|--------|
| Student has negative feedback | **+15** |
| No negative feedback | **0** |
| No feedback data available | **0** |

**Negative feedback threshold — REQUIRES TEAM CONFIRMATION:**

The `Feedback` model contains `effortRating` (Int, 1-5) and `participationRating` (Int, 1-5) as validated in `feedback.routes.ts` (Joi: `min(1).max(5)`). The repository does not contain a specification for what constitutes "negative" feedback.

**Proposed default (must be confirmed before implementation):**
- Negative feedback = any `Feedback` record where `effortRating <= 2` OR `participationRating <= 2`

This threshold treats ratings of 1-2 (out of 5) as negative signals. The Feedback module owner (Module 8) or project leads must confirm this threshold before implementation.

### 5.2 Total Score Calculation

```
totalScore = attendanceRisk + assessmentRisk + feedbackRisk
```

- Attendance risk: 0 or 20
- Assessment risk: 0 or 25
- Feedback risk: 0 or 15
- **Maximum rule-based score: 60**

### 5.3 Risk Level Categorization

| Score range | Risk level |
|-------------|------------|
| 0–30 | `LOW` |
| 31–60 | `MEDIUM` |
| 61–100 | `HIGH` |

Note: With the current three deterministic rules, the maximum deterministic score is 60, so HIGH is not currently reachable through the existing rules alone. Categorization should remain generic so that future deterministic rules can reach HIGH. When ML is available, the Hybrid Decision layer may also produce HIGH through ML escalation (see Section 7, Hybrid Decision Layer).

### 5.4 RiskScore Field Definitions

To avoid ambiguity, here are the exact semantics of each `RiskScore` column:

| Field | Stored value | Source |
|-------|-------------|--------|
| `attendanceRisk` | Rule-based attendance risk points (0 or 20) | Rule engine |
| `assessmentRisk` | Rule-based assessment risk points (0 or 25) | Rule engine |
| `feedbackRisk` | Rule-based feedback risk points (0 or 15) | Rule engine |
| `totalScore` | **Deterministic rule-based total** = `attendanceRisk + assessmentRisk + feedbackRisk` | Rule engine |
| `riskLevel` | **Final hybrid risk level** after combining rule-based and ML results | Hybrid decision layer |
| `factors` | Full explainability JSON (rule details, ML details, final decision, data availability) | All layers |

**Critical distinction:** `totalScore` always represents the deterministic rule-based score. `riskLevel` represents the final hybrid decision. These may disagree when ML escalates:

| Example | `totalScore` | Rule-based level | ML prediction | `riskLevel` (final) |
|---------|-------------|-----------------|---------------|-------------------|
| Rules only, no ML | 35 | MEDIUM | NOT_READY | MEDIUM |
| ML agrees with rules | 35 | MEDIUM | MEDIUM | MEDIUM |
| ML escalates | 35 | MEDIUM | HIGH | **HIGH** |
| ML would de-escalate (blocked) | 45 | MEDIUM | LOW | **MEDIUM** |

No new Prisma fields are required. The existing `factors Json?` field stores the complete breakdown.

---

## 6. RiskScore Snapshot Policy

### 6.1 Append-Only Snapshots

Every explicit risk calculation creates a **new** `RiskScore` record. Previous records are never overwritten, updated, or deleted by the risk engine.

- `prisma.riskScore.create()` is always used, never `update()` or `upsert()`
- `generatedAt` (defaulting to `now()`) identifies when each snapshot was generated
- Multiple snapshots for the same student accumulate over time, forming a risk history

### 6.2 History Preservation

The "latest" risk score for a student is determined by:

```ts
prisma.riskScore.findFirst({
  where: { studentId },
  orderBy: { generatedAt: 'desc' },
});
```

Risk history (all snapshots) is available via:

```ts
prisma.riskScore.findMany({
  where: { studentId },
  orderBy: { generatedAt: 'desc' },
});
```

**Batch-aware retrieval limitation:** Batch scope is explicit during risk calculation and is stored in `RiskScore.factors.scope.batchId`. However, because the current `RiskScore` Prisma model has no direct `batchId` column, batch-aware retrieval cannot currently be performed using a direct database `where: { batchId }` filter. The queries above retrieve all risk scores for a student across all batches. Ticket 14 must not introduce a schema change solely for this purpose. Any future direct batch filtering on `RiskScore` would require a separate schema change owned by a later module.

Calculation-time batch isolation is still enforced: only students belonging to the requested batch are processed, and only data from the target batch is used by providers (see Section 4).

### 6.3 No Weekly Period Modeling

Ticket 14 does NOT add a week number, period identifier, or unique constraint on `[studentId, period]` to the `RiskScore` model.

The future Weekly Risk Report module (Module 13) is responsible for its own weekly comparison requirements. It can derive weekly groupings from `generatedAt` timestamps in the existing `RiskScore` history. If Module 13 needs a dedicated period field, that is a schema change owned by Module 13, not Ticket 14.

### 6.4 Snapshot Test Requirement

A test must verify that calculating risk for the same student twice produces two separate `RiskScore` records with distinct `id` values, and that the first record is not modified. Unique record `id` is the correctness guarantee — `generatedAt` timestamps may be identical for rapid successive calculations and must not be relied upon to distinguish snapshots. See Section 13, Snapshot Tests.

---

## 7. Hybrid Decision Layer

### 7.1 Decision Logic

```
IF ml.status == "NOT_READY":
    final.riskLevel = ruleBased.riskLevel
    final.decidedBy = "RULE_ENGINE"

ELSE IF ml.status == "READY":
    IF ruleBased.riskLevel == ml.prediction:
        final.riskLevel = ruleBased.riskLevel
        final.decidedBy = "AGREEMENT"

    ELSE IF ml.prediction is MORE severe than ruleBased:
        final.riskLevel = ml.prediction
        final.decidedBy = "ML_ESCALATION"

    ELSE:
        final.riskLevel = ruleBased.riskLevel
        final.decidedBy = "RULE_ENGINE"  (ML de-escalation blocked)
```

Severity ordering: `LOW < MEDIUM < HIGH`

Rationale: The rule-based engine is the safety net. ML can escalate risk (catch students the rules miss) but cannot unilaterally reduce risk below what deterministic rules indicate. This preserves explainability while allowing ML to add value.

### 7.2 Risk Factors JSON Structure

The `RiskScore.factors` JSON field stores full explainability data.

**When ML is not ready:**

```json
{
  "dataAvailability": {
    "attendance": true,
    "assessment": true,
    "feedback": false
  },
  "scope": {
    "batchId": "uuid-of-batch"
  },
  "ruleBased": {
    "attendanceRisk": 20,
    "assessmentRisk": 25,
    "feedbackRisk": 0,
    "totalScore": 45,
    "riskLevel": "MEDIUM",
    "details": {
      "attendancePercentage": 68.5,
      "averageAssessmentScore": 42.3,
      "negativeFeedbackPresent": false,
      "totalSessions": 10,
      "sessionsAttended": 7,
      "assessmentCount": 4,
      "feedbackCount": 0,
      "negativeFeedbackCount": 0
    }
  },
  "ml": {
    "status": "NOT_READY"
  },
  "final": {
    "riskLevel": "MEDIUM",
    "decidedBy": "RULE_ENGINE"
  }
}
```

The `dataAvailability` object distinguishes between "LOW risk because data is healthy" and "LOW risk because data was not available." Each boolean indicates whether the provider returned any data for that source. This is informational only — missing data results in 0 risk points as defined in Section 5.1, not a special risk penalty.

The `scope.batchId` field records which batch the calculation was scoped to, ensuring the factors JSON is self-contained for debugging.

**When ML is ready:**

```json
{
  "dataAvailability": {
    "attendance": true,
    "assessment": true,
    "feedback": true
  },
  "scope": {
    "batchId": "uuid-of-batch"
  },
  "ruleBased": {
    "attendanceRisk": 20,
    "assessmentRisk": 0,
    "feedbackRisk": 15,
    "totalScore": 35,
    "riskLevel": "MEDIUM",
    "details": {
      "attendancePercentage": 68.5,
      "averageAssessmentScore": 62.0,
      "negativeFeedbackPresent": true,
      "totalSessions": 10,
      "sessionsAttended": 7,
      "assessmentCount": 4,
      "feedbackCount": 8,
      "negativeFeedbackCount": 2
    }
  },
  "ml": {
    "status": "READY",
    "modelVersion": "risk-model-v1",
    "prediction": "HIGH",
    "confidence": 0.68,
    "probabilities": {
      "LOW": 0.08,
      "MEDIUM": 0.24,
      "HIGH": 0.68
    }
  },
  "final": {
    "riskLevel": "HIGH",
    "decidedBy": "ML_ESCALATION"
  }
}
```

The `ml.modelVersion` field records which model version produced the prediction. This is required for:
- **Reproducibility:** understanding which model generated a historical prediction
- **Debugging:** identifying predictions from a known-bad model version
- **Model replacement:** comparing predictions across model versions during A/B evaluation

No schema changes are required. The existing `factors Json?` field accommodates this structure.

---

## 8. ML Prediction Engine

### 8.1 Candidate Features (Available Now)

| Feature | Source | Type |
|---------|--------|------|
| `attendancePercentage` | `Attendance` table (batch-scoped) | float (0-100) |
| `assessmentPercentage` | `AssessmentResult` + `Assessment` tables (batch-scoped) | float (0-100) |
| `effortRating` | `Feedback.effortRating` average (batch-scoped) | float |
| `participationRating` | `Feedback.participationRating` average (batch-scoped) | float |
| `negativeFeedbackCount` | Count of negative `Feedback` records (batch-scoped) | integer |

### 8.2 Potential Future Historical Features

| Feature | Source | Available when |
|---------|--------|---------------|
| `attendanceTrend` | Week-over-week attendance change | After sufficient time-series data |
| `assessmentTrend` | Week-over-week score change | After sufficient time-series data |
| `previousRiskScore` | `RiskScore.totalScore` from prior snapshot | After first risk calculation cycle |
| `previousRiskLevel` | `RiskScore.riskLevel` from prior snapshot | After first risk calculation cycle |
| `interventionOutcome` | `InterventionOutcome.outcome` (`IMPROVED` / `NO_CHANGE` / `DECLINED`) | After Intervention module is implemented and data collected |

### 8.3 ML Readiness

**ML status = `NOT_READY`**

A meaningful ML model requires:
1. **Sufficient historical data** — multiple risk calculation cycles producing `RiskScore` snapshots over time
2. **Temporal coverage** — at minimum several weeks of attendance, assessment, and feedback data across multiple batches
3. **Labelled training pairs** — historical feature vectors paired with known future risk outcomes (see Section 8.5)

Until these conditions are met, the system operates in **rule-based-only mode**. The ML engine reports `status: "NOT_READY"` and contributes no prediction. The hybrid decision layer falls through to the rule-based result.

**The ML model will NOT use arbitrary hardcoded weights.** When sufficient data is available, a genuine supervised learning model (e.g., logistic regression or gradient-boosted classifier via scikit-learn in the Python ML service) will be trained on historical feature vectors paired with validated labels.

### 8.4 ML Training Pipeline (Future)

```
1. Export: query historical RiskScore snapshots with features (from factors JSON)
2. Label: derive training labels from future risk outcomes (see Section 8.5)
3. Train: fit classifier on feature matrix
4. Evaluate: cross-validated metrics (precision, recall, F1 per class)
5. Version: tag model with a version identifier (e.g., "risk-model-v1")
6. Deploy: serialize model, serve via ml-service FastAPI endpoint
7. Integrate: ML engine calls ml-service HTTP endpoint
```

This pipeline lives in the `ml-service/` Python project. The Node.js backend calls it via HTTP when `ML status = READY`.

### 8.5 ML Training Target Definition

The supervised learning target is:

**Given a feature vector at time T1, predict the student's risk category at time T2.**

Target labels: `LOW`, `MEDIUM`, `HIGH`

Training labels are derived from **historical RiskScore snapshots**, not from `InterventionOutcome`:

| Training input (time T1) | Training label (time T2) |
|--------------------------|-------------------------|
| Feature vector from `RiskScore` at T1 | `RiskScore.riskLevel` from the next snapshot at T2 |

**`InterventionOutcome` is NOT automatically equivalent to a risk label.** The following naive mapping is explicitly prohibited:

```
IMPROVED  → LOW     ← WRONG: do not do this
NO_CHANGE → MEDIUM  ← WRONG: do not do this
DECLINED  → HIGH    ← WRONG: do not do this
```

`InterventionOutcome` may later be used as:
- An **additional feature** in the ML model (e.g., "student had a prior intervention with outcome X")
- An **evaluation signal** to assess whether risk predictions led to effective interventions
- A **stratification variable** for analyzing model performance across intervention outcomes

But it must not be arbitrarily converted into `LOW`/`MEDIUM`/`HIGH` risk labels. The risk label is defined by the risk engine's own assessment of a student's current engagement signals.

### 8.6 ML Failure and Timeout Behavior

The backend must fall back to the deterministic rule-based result if any of the following occur:

| Failure mode | Behavior |
|-------------|----------|
| ML service is unavailable (connection refused) | Fall back to rule-based, `ml.status = "UNAVAILABLE"` |
| ML HTTP request times out | Fall back to rule-based, `ml.status = "TIMEOUT"` |
| ML HTTP request returns non-2xx status | Fall back to rule-based, `ml.status = "ERROR"` |
| ML response is malformed (not valid JSON, missing fields) | Fall back to rule-based, `ml.status = "MALFORMED_RESPONSE"` |
| ML prediction contains invalid `RiskLevel` (not LOW/MEDIUM/HIGH) | Fall back to rule-based, `ml.status = "INVALID_PREDICTION"` |
| ML probability values are invalid (negative, NaN, don't sum to ~1.0) | Fall back to rule-based, `ml.status = "INVALID_PROBABILITIES"` |
| ML model is not loaded / not available | Fall back to rule-based, `ml.status = "NOT_READY"` |

**Timeout requirement:** The ML HTTP request must have an explicit timeout (configurable via environment variable, default 5 seconds). A risk calculation request must never hang indefinitely waiting for the ML service.

**Resilience guarantee:** Ticket 14 must remain fully functional in rule-only mode even when the entire `ml-service` infrastructure is unavailable, misconfigured, or not deployed. The rule-based engine is the minimum viable product; ML is an enhancement layer.

All ML failures are logged as warnings (not errors) because the system degrades gracefully. The `factors.ml.status` field preserves the failure reason in the persisted `RiskScore` for debugging.

---

## 9. API Plan

### 9.1 Existing Route Conventions

Routes are mounted in `server.ts` as:
```ts
app.use('/api/<resource>', authenticateJwt, resourceRoutes);
```

No existing `/api/risk` route is registered. The following empty route files exist but are unrelated: `dashboard.routes.ts`, `events.routes.ts`, `interventions.routes.ts`, `leaderboard.routes.ts`, `proofs.routes.ts`, `sessions.routes.ts`.

### 9.2 Planned API Surface

| Method | Path | Description | Permission required |
|--------|------|-------------|-------------------|
| `POST` | `/api/risk/calculate/:studentId` | Calculate and persist risk score for a single student (batch-scoped) | `risk_scores:calculate:batch` or `risk_scores:calculate:any` |
| `POST` | `/api/risk/calculate/batch/:batchId` | Calculate and persist risk scores for all students in a batch | `risk_scores:calculate:any` or `risk_scores:calculate:batch` |
| `GET` | `/api/risk/student/:studentId` | Get the most recent risk score for a student | `risk_scores:read:own`, `risk_scores:read:assigned`, `risk_scores:read:category:batch`, `risk_scores:read:any` |
| `GET` | `/api/risk/student/:studentId/history` | Get risk score history for a student | `risk_scores:read:own`, `risk_scores:read:assigned`, `risk_scores:read:any` |
| `GET` | `/api/risk/high` | List all students currently at HIGH risk | `risk_scores:read:assigned`, `risk_scores:read:any` |

### 9.3 Individual Student Calculation Request

`POST /api/risk/calculate/:studentId`

Request body:
```json
{
  "batchId": "uuid-of-batch"
}
```

`batchId` is **required**. A student may belong to multiple batches; the caller must specify which batch to scope the calculation to. Returns 404 if the student is not a member of the specified batch.

### 9.4 Batch Calculation Response Contract

`POST /api/risk/calculate/batch/:batchId`

The batch endpoint processes each student independently. A single student's failure must not discard successful results for other students.

Response:
```json
{
  "success": true,
  "data": {
    "batchId": "uuid-of-batch",
    "processed": 25,
    "succeeded": 23,
    "failed": 2,
    "results": [
      { "studentId": "...", "riskScore": { ... } },
      { "studentId": "...", "riskScore": { ... } }
    ],
    "errors": [
      { "studentId": "...", "error": "Provider failure: could not query assessment data" },
      { "studentId": "...", "error": "Unexpected error during risk calculation" }
    ]
  }
}
```

The response always returns HTTP 200 (the batch operation itself succeeded) even if some individual students failed. This follows the same pattern as the existing `POST /api/attendance/bulk` endpoint in `attendance.routes.ts`, which returns `{ created, skipped, errors }`.

### 9.5 Permissions — Read vs. Calculate

**Read permissions** (existing in `permission-catalog.ts`):

| Code | Scope | Roles |
|------|-------|-------|
| `risk_scores:read:own` | Student reads their own risk score | STUDENT |
| `risk_scores:read:category:batch` | Trainer sees risk level only (no factors/breakdown) for their batch | TRAINER |
| `risk_scores:read:assigned` | Mentor reads full risk scores for assigned students | MENTOR |
| `risk_scores:read:any` | Faculty, Coordinator, Admin read any risk score | FACULTY, COORDINATOR, ADMIN |

**Calculate permissions** (new, to be added to `permission-catalog.ts`):

| Code | Description | Roles |
|------|-------------|-------|
| `risk_scores:calculate:batch` | Trigger risk calculation for students in own batch | TRAINER |
| `risk_scores:calculate:any` | Trigger risk calculation for any student/batch | ADMIN |

The naming convention follows the existing pattern: `<resource>:<action>:<scope>`.

**Scope enforcement for calculate permissions:**

- `risk_scores:calculate:batch` (TRAINER) — applies to **both** individual student calculation (`POST /api/risk/calculate/:studentId`) and batch calculation (`POST /api/risk/calculate/batch/:batchId`), but only for students/batches within the trainer's authorized batch scope as resolved by `resolveScope()`. A TRAINER attempting to calculate risk for a student outside their authorized batch receives `403 Forbidden`.
- `risk_scores:calculate:any` (ADMIN) — unrestricted batch scope. ADMIN can calculate risk for any student in any batch.
- STUDENT and MENTOR cannot trigger risk calculation (no calculate permissions assigned).

**Rationale for separation:** A role that can read risk scores (e.g., STUDENT with `risk_scores:read:own`) must NOT automatically gain the ability to trigger risk recalculation. Calculation is a write operation that creates new `RiskScore` records and should be restricted to roles responsible for managing risk assessment (TRAINER for their batch, ADMIN system-wide).

MENTOR is intentionally excluded from calculate permissions — they consume risk data and create interventions but do not trigger recalculation. If the team decides MENTORs should trigger calculations for their assigned students, a `risk_scores:calculate:assigned` code can be added later.

**TRAINER read restriction:** The existing `risk_scores:read:category:batch` permission deliberately returns only the risk level (LOW/MEDIUM/HIGH), not the full score breakdown or factors JSON. This is documented in the permission catalog comment and must be enforced in the GET API response for TRAINER-scoped requests.

### 9.6 Response Format

All endpoints follow the existing response convention:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Student not found"
}
```

### 9.7 Registration in server.ts

```ts
import riskRoutes from './routes/risk.routes';
// ...
app.use('/api/risk', authenticateJwt, riskRoutes);
```

---

## 10. Persistence Boundary

### 10.1 Persistence Rule

A `RiskScore` record must only be persisted after **all** of the following have completed successfully:

1. Student and batch validation (student exists, belongs to batch)
2. Feature collection (all three providers have returned or returned null)
3. Rule-based calculation (scoring and categorization complete)
4. ML attempt or fallback (ML called and responded, or fallback to rule-based confirmed)
5. Hybrid decision (final `riskLevel` determined)

If any step before persistence fails (e.g., provider throws an unrecoverable error, student not found), no `RiskScore` record is created. Partially populated `RiskScore` records must never exist in the database.

### 10.2 Existing Model Reuse

The existing `RiskScore` model is used as-is. No new tables, no schema changes, no new Prisma fields.

---

## 11. Risk Calculation Observability

### 11.1 Logging Requirements

Risk calculation must produce structured log entries using the existing Winston logger (`utils/logger.ts`, JSON format, `service: 'hope-api'`).

**Per-calculation log entry (info level):**

| Field | Description |
|-------|-------------|
| `event` | `"risk.calculated"` |
| `studentId` | UUID of the student |
| `batchId` | UUID of the batch scope |
| `duration` | Calculation duration in milliseconds |
| `ruleScore` | Rule-based total score |
| `ruleLevel` | Rule-based risk level |
| `mlStatus` | ML engine status (`NOT_READY`, `READY`, `TIMEOUT`, etc.) |
| `mlFallbackReason` | If ML failed, the reason (null if ML succeeded or was NOT_READY) |
| `finalLevel` | Final hybrid risk level |
| `decidedBy` | `RULE_ENGINE`, `AGREEMENT`, or `ML_ESCALATION` |

**ML failure log entry (warn level):**

When ML falls back, log a warning with the failure mode and any error details. Do not log at error level because the system is functioning correctly (graceful degradation).

**Batch calculation summary log (info level):**

After a batch calculation completes, log a single summary: `batchId`, `processed`, `succeeded`, `failed`, `duration`.

### 11.2 What NOT to Log

- Do not log full student names, emails, or other PII
- Do not log the complete `factors` JSON (it may be large; it is already persisted in the database)
- Do not log raw feature vectors (they contain derived student performance data)

---

## 12. Performance Considerations

### 12.1 N+1 Query Avoidance

For single-student calculation, the three providers each make a small number of Prisma queries (typically 1-2 each). This is acceptable.

For batch calculation processing N students, the naive approach (calling all three providers per student in a loop) results in ~3N-6N Prisma queries. The provider layer should be designed so that future batch optimization is possible:

- Provider interfaces accept a single `studentId` in the initial implementation (correctness first)
- If batch calculation performance becomes a concern, providers can later be extended with batch-aware variants that fetch data for all students in one query and distribute results
- The `FeatureBuilder` orchestration layer is the natural place for this optimization

### 12.2 No Premature Infrastructure

Do not introduce Redis caching, BullMQ background jobs, or database-level aggregation views solely for Ticket 14. The priority order is:

1. **Correctness** — all calculations produce correct, batch-scoped results
2. **Reasonable efficiency** — avoid obvious N+1 patterns where simple Prisma `include` or `where` clauses solve the problem
3. **Scalability** — defer to future optimization if batch sizes exceed what synchronous processing handles comfortably

### 12.3 Existing Query Patterns

The assessments service (`services/assessments.service.ts`) uses Prisma `include` for nested relations and `findMany` with `where` filters. The attendance route uses `findMany` with optional `where` filters. Providers should follow these same patterns.

---

## 13. Testing Plan

### 13.1 Test Framework

Following the existing pattern: Jest 30 + Supertest with SWC transforms. Tests in `backend-api/src/__tests__/`. Prisma is mocked via `jest.mock('../lib/prisma')` (same pattern as `attendance.integration.test.ts`).

### 13.2 Test Files to Create

| File | Scope |
|------|-------|
| `__tests__/risk-engine.test.ts` | Unit tests for rule engine, feature builder, categorization, hybrid decision |
| `__tests__/risk-engine.integration.test.ts` | Integration tests for API endpoints with mocked Prisma |

### 13.3 Rule Engine Unit Tests

#### Basic rule cases

| # | Test case | Input | Expected score | Expected level |
|---|-----------|-------|---------------|----------------|
| 1 | All metrics healthy | attendance=80%, assessment=65%, no negative feedback | 0 | LOW |
| 2 | Low attendance only | attendance=70%, assessment=65%, no negative feedback | 20 | LOW |
| 3 | Low assessment only | attendance=80%, assessment=45%, no negative feedback | 25 | LOW |
| 4 | Negative feedback only | attendance=80%, assessment=65%, has negative feedback | 15 | LOW |
| 5 | All rules triggered | attendance=60%, assessment=40%, has negative feedback | 60 | MEDIUM |
| 6 | Attendance + assessment | attendance=50%, assessment=30%, no negative feedback | 45 | MEDIUM |
| 7 | Attendance + feedback | attendance=60%, assessment=70%, has negative feedback | 35 | MEDIUM |
| 8 | Assessment + feedback | attendance=90%, assessment=40%, has negative feedback | 40 | MEDIUM |

#### Boundary cases

| # | Test case | Input | Expected score | Expected level |
|---|-----------|-------|---------------|----------------|
| 9 | Attendance exactly 75% | attendance=75% | 0 (no risk) | — |
| 10 | Attendance just below 75% | attendance=74.9% | 20 | — |
| 11 | Assessment exactly 50% | assessment=50% | 0 (no risk) | — |
| 12 | Assessment just below 50% | assessment=49.9% | 25 | — |
| 13 | Total score exactly 30 | score=30 | — | LOW |
| 14 | Total score exactly 31 | score=31 | — | MEDIUM |
| 15 | Total score exactly 60 | score=60 | — | MEDIUM |
| 16 | Total score exactly 61 | score=61 | — | HIGH |

#### Failure and edge cases

| # | Test case | Expected behavior |
|---|-----------|-------------------|
| 17 | Student not found | `ServiceError` with 404 |
| 18 | Student has no attendance records | `attendanceRisk = 0` (no data, no penalty) |
| 19 | Student has no assessment records | `assessmentRisk = 0` (no data, no penalty) |
| 20 | Student has no feedback records | `feedbackRisk = 0` (no data, no penalty) |
| 21 | All data sources empty | `totalScore = 0`, `riskLevel = LOW` |
| 22 | Assessment with maxScore = 0 | Exclude from average (avoid division by zero) |
| 23 | Provider throws error | Service catches, returns 500 with descriptive error |
| 24 | Invalid studentId format | Joi validation rejects with 400 |

### 13.4 Scope Tests

| # | Test case | Expected behavior |
|---|-----------|-------------------|
| 25 | Attendance from another batch does not affect calculation | Student has attendance in batch A and batch B; calculating risk for batch A uses only batch A attendance |
| 26 | Assessment from another batch does not affect calculation | Student has results in batch A and batch B; calculating risk for batch A uses only batch A assessments |
| 27 | Feedback from another batch does not affect calculation | Student has feedback in batch A sessions and batch B sessions; calculating risk for batch A uses only batch A feedback |
| 28 | Student not in specified batch | Returns 404 when `BatchMember` record does not exist for `[batchId, studentId]` |

### 13.5 Snapshot Tests

| # | Test case | Expected behavior |
|---|-----------|-------------------|
| 29 | Repeated calculation creates separate snapshots | Calculating risk for the same student twice produces two distinct `RiskScore` records with different `id` values (timestamps may coincide for rapid calculations) |
| 30 | Previous snapshot is not modified | After second calculation, first `RiskScore` record remains unchanged |

### 13.6 Hybrid Decision Tests

| # | Test case | Expected behavior |
|---|-----------|-------------------|
| 31 | Rule MEDIUM + ML HIGH → final HIGH | ML escalation applied, `decidedBy = "ML_ESCALATION"` |
| 32 | Rule HIGH + ML MEDIUM → final HIGH | ML de-escalation blocked, `decidedBy = "RULE_ENGINE"` |
| 33 | Rule LOW + ML MEDIUM → final MEDIUM | ML escalation applied, `decidedBy = "ML_ESCALATION"` |
| 34 | Rule and ML agreement → agreed level | `decidedBy = "AGREEMENT"` |
| 35 | ML not ready → rule-based result | `decidedBy = "RULE_ENGINE"`, `ml.status = "NOT_READY"` |

### 13.7 ML Failure Tests

| # | Test case | Expected behavior |
|---|-----------|-------------------|
| 36 | ML service connection refused | Falls back to rule-based, `ml.status = "UNAVAILABLE"` |
| 37 | ML request timeout | Falls back to rule-based, `ml.status = "TIMEOUT"` |
| 38 | ML returns malformed JSON | Falls back to rule-based, `ml.status = "MALFORMED_RESPONSE"` |
| 39 | ML returns invalid risk level | Falls back to rule-based, `ml.status = "INVALID_PREDICTION"` |
| 40 | ML returns invalid probabilities | Falls back to rule-based, `ml.status = "INVALID_PROBABILITIES"` |

### 13.8 Batch Calculation Tests

| # | Test case | Expected behavior |
|---|-----------|-------------------|
| 41 | Partial batch failure does not discard successes | Student C fails, but A, B, D risk scores are persisted |
| 42 | Correct processed/succeeded/failed counts | Response counters match actual results |
| 43 | Empty batch returns empty results | `processed = 0`, `succeeded = 0`, `results = []` |

### 13.9 Missing-Data Tests

| # | Test case | Expected behavior |
|---|-----------|-------------------|
| 44 | factors contains dataAvailability | Persisted `factors` JSON includes `dataAvailability` with boolean per source |
| 45 | Missing attendance → dataAvailability.attendance = false | No attendance records → `attendanceRisk = 0`, availability flag is false |
| 46 | Missing feedback → dataAvailability.feedback = false | No feedback records → `feedbackRisk = 0`, availability flag is false |
| 47 | All sources missing → all flags false, score = 0 | `totalScore = 0`, `riskLevel = LOW`, all availability flags false |

### 13.10 RBAC Tests

| # | Test case | Expected behavior |
|---|-----------|-------------------|
| 48 | ADMIN can trigger calculation | POST calculate returns 201 |
| 49 | TRAINER can trigger batch calculation for own batch | POST batch calculate returns 200 |
| 50 | STUDENT cannot trigger calculation | POST calculate returns 403 |
| 51 | MENTOR cannot trigger calculation | POST calculate returns 403 |
| 52 | TRAINER can calculate individual student risk within own batch | POST calculate/:studentId (student in trainer's batch) returns 201 |
| 53 | TRAINER cannot calculate individual student risk outside own batch | POST calculate/:studentId (student NOT in trainer's batch) returns 403 |
| 54 | ADMIN can calculate individual student risk for any batch | POST calculate/:studentId (any student/batch) returns 201 |
| 55 | STUDENT can read own risk score | GET student/:ownId returns 200 |
| 56 | STUDENT cannot read another student's risk score | GET student/:otherId returns 403 |
| 57 | MENTOR can read assigned student's risk score | GET student/:assignedId returns 200 |
| 58 | TRAINER sees only risk level (not factors/breakdown) | GET student/:batchStudentId returns 200, response omits `factors` and score components |
| 59 | FACULTY can read any risk score | GET student/:anyId returns 200 with full details |
| 60 | ADMIN can list high-risk students | GET /high returns 200 |
| 61 | STUDENT cannot list high-risk students | GET /high returns 403 |

### 13.11 Model Metadata Tests

| # | Test case | Expected behavior |
|---|-----------|-------------------|
| 62 | ML modelVersion is preserved in factors when ML is ready | `factors.ml.modelVersion` matches the version returned by the ML service |
| 63 | ML modelVersion is absent when ML is not ready | `factors.ml` contains only `{ "status": "NOT_READY" }` |

### 13.12 Integration Tests (API Layer)

| # | Test case | Method | Path | Expected |
|---|-----------|--------|------|----------|
| 64 | Calculate risk for valid student | POST | `/api/risk/calculate/:studentId` | 201, persisted `RiskScore` |
| 65 | Calculate risk for nonexistent student | POST | `/api/risk/calculate/:studentId` | 404 |
| 66 | Calculate risk without batchId in body | POST | `/api/risk/calculate/:studentId` | 400 (Joi validation) |
| 67 | Batch calculate for valid batch | POST | `/api/risk/calculate/batch/:batchId` | 200, partial success response |
| 68 | Batch calculate for empty batch | POST | `/api/risk/calculate/batch/:batchId` | 200, `processed = 0` |
| 69 | Get latest risk score | GET | `/api/risk/student/:studentId` | 200, most recent score |
| 70 | Get risk history | GET | `/api/risk/student/:studentId/history` | 200, array ordered by `generatedAt` desc |
| 71 | Get high-risk students | GET | `/api/risk/high` | 200, filtered list |

**Total test requirements: 71**

---

## 14. Integration Plan (Future Modules)

### 14.1 Downstream Integration Map

```
Ticket 14 (this module)
   produces → RiskScore records
        |
        ├──→ Weekly Risk Report (Module 13)
        |       Reads: RiskScore WHERE generatedAt >= lastWeek
        |       Groups by riskLevel, compares to previous week
        |       Sends email digest to mentors
        |
        ├──→ Mentor Alert System (Module 14-alerts)
        |       Triggered when: RiskScore.riskLevel == HIGH
        |       Action: BullMQ job → email + in-app Notification
        |       Uses: Notification model (already in schema)
        |
        ├──→ Intervention Workflow (Modules 15-16)
        |       Links: Intervention.riskScoreId → RiskScore.id
        |       Mentor creates intervention based on risk assessment
        |       InterventionOutcome feeds back into ML training data
        |
        └──→ Engagement Dashboard (Modules 10-11)
                Reads: latest RiskScore per student
                Displays: risk level badge, score trend chart
```

### 14.2 Integration Contracts

**For downstream consumers of Ticket 14:**

```ts
// Other modules can query the latest risk score for a student:
prisma.riskScore.findFirst({
  where: { studentId },
  orderBy: { generatedAt: 'desc' },
});

// Or find all high-risk students (latest score per student):
prisma.riskScore.findMany({
  where: { riskLevel: 'HIGH' },
  distinct: ['studentId'],
  orderBy: { generatedAt: 'desc' },
});
```

**Note on batch-aware retrieval:** The above queries filter by `studentId` and `riskLevel` only — there is no `batchId` column on `RiskScore`. The batch context is stored inside `factors.scope.batchId` (a JSON field), which cannot be used in a direct Prisma `where` clause. These queries therefore return risk scores across all batches. If downstream consumers need batch-specific retrieval, they must either post-filter results by parsing `factors.scope.batchId` in application code, or a future schema change must add a `batchId` column to `RiskScore` (not owned by Ticket 14).

**For ML feedback loop (future):**

```ts
// Training data export: risk scores with features (from factors JSON)
// paired with subsequent risk snapshots as labels
prisma.riskScore.findMany({
  where: { studentId },
  orderBy: { generatedAt: 'asc' },
});
// Each snapshot at T1 is paired with the next snapshot at T2 as the label
```

### 14.3 Event-Based Integration (Future)

When BullMQ infrastructure is available, Ticket 14's calculation endpoint can optionally enqueue:
- `risk.high-detected` job when a student transitions to HIGH risk
- `risk.batch-complete` job after a batch calculation finishes

These jobs would be consumed by the Mentor Alert System (Module 14-alerts). This integration is NOT implemented in Ticket 14 — the alert system team will wire it up.

### 14.4 Weekly/Time-Period Boundary

Ticket 14 calculates risk using **currently available data** within the selected student/batch scope. It does NOT:
- Implement weekly snapshots or weekly scheduling
- Implement weekly risk reports
- Add weekly period identifiers to `RiskScore`
- Add cron jobs or scheduled execution

The future Weekly Risk Report module (Module 13) is responsible for:
- Scheduling when risk calculations are triggered (e.g., weekly cron)
- Comparing `RiskScore` snapshots across time periods using `generatedAt`
- Grouping and aggregating risk data for reports

Module 13 can call Ticket 14's `POST /api/risk/calculate/batch/:batchId` endpoint to trigger calculations on its own schedule.

---

## 15. Implementation Phases

### Phase 1 — Repository Inspection and Contracts

**Status: THIS DOCUMENT**

- Inspect all existing code patterns, schema, routes, services, tests
- Document what exists vs. what is missing
- Define interfaces and contracts for all components
- Create `IMPLEMENTATION.md` (this file)

**Deliverable:** `IMPLEMENTATION.md` reviewed and approved

**Pre-implementation requirement:** Confirm attendance status semantics and negative feedback threshold with Module 5 and Module 8 owners (see Section 5.1).

---

### Phase 2 — Feature Builder

Create the data provider layer and feature builder.

**Files to create:**
- `backend-api/src/providers/attendance.provider.ts`
- `backend-api/src/providers/assessment.provider.ts`
- `backend-api/src/providers/feedback.provider.ts`
- `backend-api/src/services/risk/feature-builder.ts`

**Responsibilities:**
- `AttendanceProvider` — queries `Attendance` table (batch-scoped via `Session.batchId`), returns `{ totalSessions, sessionsAttended, attendancePercentage }` or `null`
- `AssessmentProvider` — queries `AssessmentResult` + `Assessment` (batch-scoped via `Assessment.batchId`), returns `{ assessmentCount, averageScorePercentage }` or `null`
- `FeedbackProvider` — queries `Feedback` (batch-scoped via `Session.batchId`), returns `{ feedbackCount, negativeFeedbackCount, hasNegativeFeedback, averageEffortRating, averageParticipationRating }` or `null`
- `FeatureBuilder` — accepts `(studentId, batchId)`, calls all three providers with batch scope, assembles a typed `StudentFeatures` object

**Key constraints:**
- Providers are read-only. They do NOT own or modify the data they query.
- All provider queries are batch-scoped. No cross-batch data leakage.

---

### Phase 3 — Rule-Based Risk Engine

Implement the deterministic scoring rules.

**Files to create:**
- `backend-api/src/services/risk/rule-engine.ts`

**Responsibilities:**
- Accept a `StudentFeatures` object
- Apply attendance rule (< 75% → +20)
- Apply assessment rule (< 50% → +25)
- Apply feedback rule (negative → +15)
- Return `{ attendanceRisk, assessmentRisk, feedbackRisk, totalScore, riskLevel, details }`

**Key constraint:** Pure function — no database access, no side effects. Testable in isolation.

---

### Phase 4 — Risk Categorization

Implement the score-to-level mapping.

**Implemented within:** `rule-engine.ts` (or a small `categorizer.ts` if cleaner)

**Logic:**
```
0–30   → LOW
31–60  → MEDIUM
61–100 → HIGH
```

---

### Phase 5 — RiskScore Persistence

Persist results to the existing `RiskScore` table.

**Files to create:**
- `backend-api/src/services/risk/risk-score.service.ts`

**Responsibilities:**
- Validate student exists and belongs to the specified batch
- Call FeatureBuilder → RuleEngine → HybridDecisionLayer
- Persist to `prisma.riskScore.create()` with all fields + `factors` JSON (including `dataAvailability` and `scope`)
- Return the created record

**Key constraints:**
- Uses the existing `RiskScore` model. No schema changes. No new tables.
- Always creates a new record (append-only snapshots). Never updates or upserts.
- Only persists after the full pipeline completes successfully (see Section 10).

---

### Phase 6 — API Layer

Create routes, controllers, and Joi validators.

**Files to create:**
- `backend-api/src/routes/risk.routes.ts`
- `backend-api/src/controllers/risk.controller.ts`
- `backend-api/src/validators/risk.validator.ts`

**Files to modify:**
- `backend-api/src/server.ts` — add `app.use('/api/risk', authenticateJwt, riskRoutes);`
- `backend-api/src/prisma/permission-catalog.ts` — add `risk_scores:calculate:batch` and `risk_scores:calculate:any` codes

**Endpoints:** See Section 9.2.

**RBAC:** Use existing `requirePermission()` and `resolveScope()` middleware. Calculate endpoints use the new `risk_scores:calculate:*` permissions. Read endpoints use the existing `risk_scores:read:*` permissions.

---

### Phase 7 — Testing

Write unit and integration tests.

**Files to create:**
- `backend-api/src/__tests__/risk-engine.test.ts`
- `backend-api/src/__tests__/risk-engine.integration.test.ts`

**Test cases:** See Section 13 for the full matrix (71 test cases).

**Pattern:** Follow existing test pattern — mock Prisma via `jest.mock('../lib/prisma')`, create Express app with routes, use Supertest for HTTP assertions.

---

### Phase 8 — ML Data Preparation / Training Pipeline

Prepare the ML training infrastructure in the Python service.

**Files to implement:**
- `ml-service/requirements.txt` — add FastAPI, uvicorn, scikit-learn, pandas, numpy, pydantic
- `ml-service/app/main.py` — FastAPI app setup
- `ml-service/app/routes/health.py` — health check endpoint
- `ml-service/app/models/risk_request.py` — Pydantic model for feature input
- `ml-service/app/models/risk_response.py` — Pydantic model for prediction output (including `modelVersion`)
- `ml-service/app/config.py` — environment configuration

**NOT included in Phase 8:** actual model training (requires historical data).

**Data requirements for training:**
- Minimum several weeks of `RiskScore` snapshots with corresponding features (from `factors` JSON)
- Sufficient temporal coverage to derive training labels (feature at T1 → risk level at T2)
- Sufficient volume across all three risk levels

---

### Phase 9 — ML Prediction Service

Implement the prediction endpoint when data is available.

**Files to implement:**
- `ml-service/app/risk_engine/calculator.py` — model loading and prediction
- `ml-service/app/risk_engine/categorizer.py` — probability-to-level mapping
- `ml-service/app/routes/risk.py` — `POST /predict` endpoint
- `ml-service/tests/test_risk_engine.py` — tests with known inputs

**Backend integration:**
- `backend-api/src/services/ml.service.ts` — HTTP client calling `ml-service` predict endpoint, with configurable timeout

**Model details:**
- Supervised classifier (logistic regression baseline, gradient-boosted tree for production)
- Input: feature vector from FeatureBuilder
- Output: `{ modelVersion: string, prediction: RiskLevel, probabilities: { LOW, MEDIUM, HIGH }, confidence: float }`

---

### Phase 10 — Hybrid Decision Layer

Combine rule-based and ML outputs.

**Files to create:**
- `backend-api/src/services/risk/hybrid-decision.ts`

**Logic:** See Section 7.1. Rules are the safety net; ML can escalate but not de-escalate.

**Modify:** `risk-score.service.ts` to call `HybridDecisionLayer` instead of returning rule-based results directly.

---

### Phase 11 — Integration with Future Modules

Wire up downstream consumers as they become available.

**Integration points (owned by other teams, documented here for coordination):**

| Consumer | Integration action | Owner |
|----------|--------------------|-------|
| Weekly Risk Report | Query `RiskScore` table with date filters, call calculate endpoint on schedule | Module 13 team |
| Mentor Alert | Subscribe to high-risk events (BullMQ or polling) | Module 14-alerts team |
| Intervention | Pass `riskScoreId` when creating intervention from alert | Module 15-16 team |
| Dashboard | Read latest `RiskScore` per student for display | Module 10-11 team |

**Ticket 14 provides:** The `RiskScore` records and the API endpoints. It does NOT implement the consumers.

---

## 16. Non-Goals

Ticket 14 must **NOT**:

- Create another `RiskScore` table (use the existing one)
- Create another `Attendance` table (use the existing one)
- Create another `Assessment` table (use the existing one)
- Create another `Feedback` table (use the existing one)
- Implement the Weekly Risk Report (Module 13)
- Implement the Mentor Alert System (Module 14-alerts)
- Implement the Intervention Workflow (Modules 15-16)
- Modify unrelated team modules (attendance routes, feedback routes, etc.)
- Fabricate ML predictions (use genuine trained models or report `NOT_READY`)
- Generate fake production services for missing modules
- Redesign the Prisma schema unnecessarily
- Add new Prisma models or enums (except new permission codes in the catalog)
- Modify existing route files owned by other modules
- Implement BullMQ job infrastructure (empty stubs are other teams' scope)
- Implement weekly scheduling, cron jobs, or weekly period modeling
- Redefine Attendance business rules or Feedback rating semantics owned by other modules
- Map `InterventionOutcome` directly to risk level labels

---

## 17. File Inventory

### Files to CREATE (Phases 2-7)

```
backend-api/src/providers/attendance.provider.ts
backend-api/src/providers/assessment.provider.ts
backend-api/src/providers/feedback.provider.ts
backend-api/src/services/risk/feature-builder.ts
backend-api/src/services/risk/rule-engine.ts
backend-api/src/services/risk/risk-score.service.ts
backend-api/src/services/risk/hybrid-decision.ts
backend-api/src/routes/risk.routes.ts
backend-api/src/controllers/risk.controller.ts
backend-api/src/validators/risk.validator.ts
backend-api/src/__tests__/risk-engine.test.ts
backend-api/src/__tests__/risk-engine.integration.test.ts
```

### Files to MODIFY (Phase 6)

```
backend-api/src/server.ts                     (add risk route import + mount)
backend-api/src/prisma/permission-catalog.ts   (add risk_scores:calculate:batch and risk_scores:calculate:any)
```

### Files to implement LATER (Phases 8-10)

```
ml-service/requirements.txt
ml-service/app/main.py
ml-service/app/config.py
ml-service/app/routes/health.py
ml-service/app/routes/risk.py
ml-service/app/models/risk_request.py
ml-service/app/models/risk_response.py
ml-service/app/risk_engine/calculator.py
ml-service/app/risk_engine/categorizer.py
ml-service/tests/test_risk_engine.py
backend-api/src/services/ml.service.ts
```

### Files NOT to modify

```
backend-api/src/prisma/schema.prisma          (no schema changes)
backend-api/src/routes/attendance.routes.ts    (owned by Module 5)
backend-api/src/routes/feedback.routes.ts      (owned by Module 8)
backend-api/src/routes/assessments.routes.ts   (owned by Module 6)
backend-api/src/routes/interventions.routes.ts (owned by Module 15-16)
backend-api/src/jobs/*                         (owned by alert/report modules)
```

---

## 18. Open Decisions Requiring Team Input

| # | Decision | Who decides | Impact on Ticket 14 |
|---|----------|-------------|-------------------|
| 1 | Which `AttendanceStatus` values count as "attended"? Proposed: `PRESENT` + `LATE` = attended; `ABSENT` + `EXCUSED` = not attended | Module 5 owner (Sree Harini / Harinee S) or project leads | Affects `AttendanceProvider` query logic |
| 2 | What feedback rating threshold constitutes "negative"? Proposed: `effortRating <= 2` OR `participationRating <= 2` | Module 8 owner (Tisha Angel) or project leads | Affects `FeedbackProvider` query logic |

These must be confirmed before Phase 2 implementation begins. The proposed defaults are documented in Section 5.1 and will be used if no alternative is specified.

---

## 19. Definition of Done

Ticket 14 is complete only when **all** of the following are satisfied:

### Core Engine
- [ ] Rule-based risk engine is implemented with the three documented rules (attendance < 75% → +20, assessment < 50% → +25, negative feedback → +15)
- [ ] Maximum rule-based score is 60 (three rules combined)
- [ ] Risk categorization maps scores correctly: 0–30 → LOW, 31–60 → MEDIUM, 61–100 → HIGH
- [ ] Hybrid decision layer is implemented: ML can escalate but not de-escalate rule-based results

### Batch Scope
- [ ] All risk calculations are batch-scoped — attendance, assessment, and feedback queries filter by the target batch
- [ ] Single-student calculation requires `batchId` in the request body
- [ ] Batch calculation processes only students in `BatchMember` for that batch
- [ ] Cross-batch isolation is verified by tests

### Data Integrity
- [ ] Attendance status semantics are verified against the Attendance module specification before hardcoding (Section 5.1, Section 18)
- [ ] Feedback negative threshold is verified against the Trainer Feedback module specification before hardcoding (Section 5.1, Section 18)
- [ ] `RiskScore.totalScore` stores the deterministic rule-based score only
- [ ] `RiskScore.riskLevel` stores the final hybrid decision level
- [ ] `RiskScore.factors` JSON includes `dataAvailability`, `scope`, `ruleBased`, `ml`, and `final` sections

### Snapshots
- [ ] Every risk calculation creates a new `RiskScore` record via `prisma.riskScore.create()`
- [ ] Existing `RiskScore` records are never overwritten, updated, or deleted by the risk engine
- [ ] Repeated calculations for the same student produce distinct records (verified by unique `id`)

### Permissions
- [ ] Read permissions (`risk_scores:read:*`) and calculate permissions (`risk_scores:calculate:*`) are separated
- [ ] `risk_scores:calculate:batch` and `risk_scores:calculate:any` are added to `permission-catalog.ts`
- [ ] TRAINER cannot calculate risk for batches they are not assigned to
- [ ] STUDENT and MENTOR cannot trigger risk calculations
- [ ] TRAINER read responses omit `factors` and score breakdown (category-only access)

### Batch Partial Failure
- [ ] Batch calculation processes students independently
- [ ] A single student's failure does not discard other students' successful results
- [ ] Batch response includes `processed`, `succeeded`, `failed`, `results`, and `errors`

### Missing Data
- [ ] Missing attendance/assessment/feedback contributes zero risk points (no penalty for absent data)
- [ ] `factors.dataAvailability` records which data sources were available (boolean per source)
- [ ] LOW risk from missing data is distinguishable from LOW risk from healthy performance

### ML
- [ ] ML reports `status: "NOT_READY"` until a real trained model with sufficient labelled historical data exists
- [ ] No fake ML predictions or arbitrary hardcoded ML weights are used
- [ ] ML failures (timeout, connection refused, malformed response, invalid prediction/probabilities) safely fall back to rule-based results
- [ ] ML fallback reason is recorded in `factors.ml.status`
- [ ] ML HTTP requests have an explicit configurable timeout
- [ ] When ML is ready, `factors.ml.modelVersion` records the model version

### Schema
- [ ] No new Prisma models or enums are introduced
- [ ] No unnecessary modifications to `schema.prisma`
- [ ] The existing `RiskScore` model is used as-is

### Tests
- [ ] All 71 documented test cases pass (Section 13)
- [ ] Existing backend tests (`npm test` in `backend-api/`) continue to pass
- [ ] No regressions in other modules' tests or builds

### Boundaries
- [ ] Weekly Risk Report is NOT implemented (Module 13 responsibility)
- [ ] Mentor Alert System is NOT implemented (Module 14-alerts responsibility)
- [ ] Intervention Workflow is NOT implemented (Modules 15-16 responsibility)
- [ ] No weekly period fields, cron jobs, or scheduled execution are added
- [ ] `InterventionOutcome` is NOT mapped directly to risk level labels
