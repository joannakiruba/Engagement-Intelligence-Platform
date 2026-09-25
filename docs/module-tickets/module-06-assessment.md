# Module 6 — Assessment & Performance Capture — Implementation Roadmap

**Branch:** `ticket-6-assessment-module` (based off `origin/ticket-1`)

**Owner:** Meenakshi

---

## 1. Module Goal

Module 6 is a fully dynamic assessment system. Trainers can create assessments with any number of sections (e.g. Aptitude, Coding, Technical — names are never hardcoded), each section can contain any number of questions with individual max marks, and student scores are recorded at the question level. Section totals, weighted scores, and overall assessment scores are all calculated from question-level data. The module also supports bulk CSV upload of question-level scores, result viewing at every granularity (question, section, overall), and integrates with the existing Batch and User models for student validation.

---

## 2. Existing Data (from `ticket-1`)

These models already exist in `backend-api/prisma/schema.prisma` and must be preserved:

| Model | Key fields | How Module 6 uses it |
|---|---|---|
| **Assessment** | `id`, `batchId`, `title`, `type` (enum: CODING_TEST / QUIZ / ASSIGNMENT / CONTEST), `maxScore`, `assessmentDate`, `createdAt` | The parent entity. Module 6 adds `updatedAt` and a `sections` relation to this model. |
| **AssessmentResult** | `id`, `assessmentId`, `studentId`, `score`, `remarks`, `createdAt`. Unique on `[assessmentId, studentId]` | Stores the final overall score per student per assessment. Calculated from question-level scores. |
| **Batch** | `id`, `name`, `startDate`, `endDate` | Every assessment belongs to a batch. |
| **BatchMember** | `batchId`, `studentId`. Unique on `[batchId, studentId]` | Used to verify a student belongs to the assessment's batch before accepting scores. |
| **User** | `id`, `name`, `email`, `roleId` | Student identity. Module 6 adds a `studentQuestionScores` relation to this model. |

---

## 3. Key Design Decisions

- When sections/questions are provided, `Assessment.maxScore` is automatically calculated from the sum of question `maxScore` values.
- A provided `maxScore` during creation is optional/ignored when sections exist.
- `AssessmentResult.score` is always calculated from question-level scores — never independently entered.
- Section names are free text — never validated against a hardcoded list.
- If any section has weightage, all sections must have weightage, and the total must equal exactly 100%.
- Structural modifications (add/remove sections/questions) are rejected if any student scores exist.

---

## 4. Testing Checklist

### Schema and migration:
- [ ] Prisma schema validates without errors
- [ ] Migration applies cleanly to a fresh database
- [ ] Prisma generate succeeds and produces correct client types

### Assessment CRUD:
- [ ] Create assessment without sections — should succeed
- [ ] Create assessment with sections/questions — should create full nested structure
- [ ] Create with sections — maxScore should be auto-calculated from question totals (provided maxScore ignored)
- [ ] Create with partial weightage (some sections have it, some don't) — should return 400
- [ ] Create with weightages totaling 80% — should return 400
- [ ] Create with weightages totaling 100% — should succeed
- [ ] Create with invalid batchId — should return 404
- [ ] List assessments — should include section counts
- [ ] Get assessment by ID — should return full nested structure
- [ ] Update title only — should preserve sections and questions
- [ ] Delete assessment — should delete results, sections, questions, and question scores

### Question-level score submission:
- [ ] Submit valid scores for all questions — should return 201 with calculated overall
- [ ] Submit for student not in batch — should return 400
- [ ] Submit score exceeding question's maxScore — should return 400
- [ ] Submit negative score — should return 400
- [ ] Submit with invalid questionId — should return 400
- [ ] Submit duplicate scores for same student+question — should update (upsert)
- [ ] Overall AssessmentResult should be auto-calculated after submission
- [ ] Weighted overall should be correct when weightage is configured

### Result viewing:
- [ ] Get all results — should show per-student breakdown with section totals
- [ ] Get individual student result — should show per-question scores grouped by section

### Bulk CSV upload:
- [ ] Upload valid CSV — all rows succeed, overall scores recalculated
- [ ] CSV with missing `questionId` column — should return 400
- [ ] CSV with questionId that doesn't belong to this assessment — row should error
- [ ] CSV with score exceeding question maxScore — row should error
- [ ] CSV with student not in batch — row should error
- [ ] CSV with quoted fields — should parse correctly
- [ ] Upload empty file — should return 400
- [ ] Multiple rows per student (different questions) — all should succeed
- [ ] Duplicate student+question rows in same CSV — last value wins
