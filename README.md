# HOPE — Engagement Intelligence Platform

HOPE is a student engagement and mentoring platform that brings attendance, assessments, feedback, tasks, events, and interventions into one application.

It provides role-based access for **Students, Trainers, Faculty, Mentors, Coordinators, and Administrators**.

> This README describes the implemented features in the repository reviewed on 15 October 2026. Not every workflow has been independently retested end-to-end. Email delivery, Google Drive uploads, and ML features require additional configuration.

## Features

### Authentication and User Management

- Login and logout.
- JWT authentication with refresh-cookie session restoration.
- Role-based dashboards and permission-controlled access.
- Administrator user creation, search, and filtering.
- User role changes and account activation/deactivation.
- Account activation and password-reset pages.
- Profile viewing and editing of name and phone number.

**How to use:** Sign in with your account. Administrators can manage users through **User Management**. All users can open **My Profile** from the profile menu.

> Activation and password-reset email delivery requires SMTP, Redis, and the background worker.

### Batch and Session Management

- Create batches.
- Add or remove students from batch rosters.
- View batch details and student lists.
- Create and delete sessions.

**How to use:** Open **Batches**, select or create a batch, add students, and create sessions from the batch details page.

### Attendance Management

- Manual attendance marking.
- Timed attendance windows.
- Fullscreen QR codes for student check-in.
- Student camera-based QR scanning.
- Personal attendance history.
- Staff attendance views.
- Excused-attendance review.
- CSV attendance exports.

**How to use:**

1. Create a session and configure its attendance window.
2. Open the fullscreen QR display.
3. Students sign in and scan the live QR code.
4. Review attendance from the student or staff attendance page.

**Current limitation:** The small QR popup uses an outdated check-in URL. Use the **fullscreen QR display**.

For phone access, use an application URL reachable from the phone. The in-app camera scanner generally requires HTTPS outside localhost.

### Assessments and Scores

- Create assessments with sections and questions.
- Enter student scores manually.
- Upload assessment scores through CSV.
- View recorded assessment results.
- Students can access their own results.

**How to use:** Open **Assessments**, create an assessment, add questions, and use score entry or bulk upload.

Expected score CSV format:

```csv
studentId,questionId,score
<student-id>,<question-id>,8
```

Use actual database IDs. Students must belong to the assessment’s batch, and scores must satisfy the question limits.

> This module records assessments and scores; it should not be described as a complete timed online examination system.

### Student Feedback

- Submit feedback and ratings for students.
- View received or submitted feedback according to permissions.
- Support engagement monitoring through recorded feedback.

**How to use:** Authorized staff open **Feedback**, select the relevant student/context, and submit ratings and comments.

### Task Management

- Create tasks for selected batches.
- Configure deadlines and maximum marks.
- Track student progress.
- Award marks for student work.

Student progress states:

- `NOT_STARTED`
- `IN_PROGRESS`
- `COMPLETED`

**How to use:** Staff create tasks through **Tasks**. Students update their progress, and authorized staff award marks from task details.

### Events and Registration

- Create events for selected batches.
- View available events.
- Express interest in an event.
- Confirm event registration.

**How to use:** Staff create an event through **Events**. Students open the event list, mark interest, and confirm registration.

> The active frontend does not expose every backend event-editing or round-management operation.

### Proof Submission and Review

- Upload event participation proofs.
- View submitted proofs.
- Approve or reject submissions with remarks.

Supported formats: **PNG, JPEG, GIF, and PDF**, up to **10 MB**.

**How to use:** Students open **Proofs**, select an event, and upload a file. Authorized staff review the submission.

**Requires:** Google Drive service-account credentials and access to the configured folder.

> The current upload implementation gives uploaded files an `anyone`/`reader` permission. Review this behavior before uploading private documents.

### Engagement Analytics and Leaderboard

- Attendance and assessment summaries.
- Batch-level and student-level engagement views.
- Batch engagement trends.
- Weekly batch leaderboards.
- Attendance, assessment, and contest score components.

**How to use:** Open **Engagement** to review available metrics. Open **Leaderboard** and select a batch and reporting week.

Missing contest data is indicated in the leaderboard.

### Mentor Assignments

- Assign students to mentors.
- View existing mentor–student assignments.
- Remove assignments.

**How to use:** An authorized user opens **Mentor Assignments** and selects the mentor and student.

### Risk Monitoring and Mentor Alerts

- View high-risk students.
- Recalculate student risk.
- Use rule-based risk decisions with optional ML support.
- Review mentor alerts.
- Update alert status and record responses.

**How to use:** Open **Risk Overview** to review available risk records. Open **Mentor Alerts** to review generated alerts and record actions.

The backend retains its rule-based risk decision when ML is unavailable. ML can escalate risk severity but does not reduce a higher rule-based level.

**Requires for ML and alerts:** The Python service, a compatible database, a loadable model, and the relevant alert-generation processes.

> The repository includes a synthetic-data demo model training script. Model availability does not establish real-world prediction accuracy.

### Intervention Tracking

- Create interventions from eligible alerts.
- Track intervention status.
- Add progress notes.
- Create action items.
- Allow assigned students to complete permitted action items.
- Record intervention outcomes.

Supported outcomes include:

- `IMPROVED`
- `NO_CHANGE`
- `DECLINED`

**How to use:** Open **Interventions**, create an intervention from an eligible alert, add action items and notes, and record the outcome.

### Weekly Mentor Reports

The backend supports:

- Weekly report previews.
- Report queue triggers.
- Schedule configuration.
- Background email processing.

There is currently **no dedicated weekly-report page** in the active frontend.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/weekly-reports/preview` | Preview report data |
| GET | `/api/weekly-reports/schedule` | View schedule configuration |
| POST | `/api/weekly-reports/trigger` | Queue reports |

These endpoints require authentication and appropriate permissions.

Email delivery requires SMTP, Redis, and the worker. Recurring execution also requires a configured scheduler.

## Technology Stack

| Component | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Routing and API requests | React Router, Axios |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma |
| Authentication | JWT, refresh cookies, bcrypt |
| Validation | Joi |
| Background jobs | Redis, BullMQ |
| Email | Nodemailer, SMTP |
| File storage | Google Drive API |
| ML service | Python, FastAPI, scikit-learn, pandas |
| API documentation | Swagger UI |

## Local Setup

### Prerequisites

- Node.js 20.19 or later
- npm
- Git
- PostgreSQL 16
- Redis 7
- Docker Compose, if using the supplied local database configuration
- Python 3.11 for the optional ML service

The commands below use Bash or Git Bash.

### 1. Clone and Install

```bash
git clone https://github.com/joannakiruba/Engagement-Intelligence-Platform.git
cd Engagement-Intelligence-Platform
npm run install:all
```

### 2. Create Environment Files

```bash
cp backend-api/.env.example backend-api/.env
cp frontend/.env.example frontend/.env
```

Do not overwrite existing environment files containing your configuration.

### 3. Start PostgreSQL and Redis

```bash
export LOCAL_DB_PASSWORD='replace-with-your-local-db-password'
docker compose -f compose.local.yml up -d
```

Local service ports:

| Service | Port |
| --- | --- |
| PostgreSQL | `55432` |
| Redis | `56379` |

### 4. Configure the Backend

Update `backend-api/.env`:

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:55432/hope_platform?schema=public"
REDIS_URL="redis://localhost:56379/0"

JWT_SECRET="REPLACE_WITH_A_RANDOM_SECRET"
TOKEN_HASH_SECRET="REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET"

SEED_TEST_PASSWORD="REPLACE_WITH_YOUR_DEVELOPMENT_PASSWORD"

PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"

WEEKLY_REPORT_ENABLED=false
ML_SERVICE_URL="http://localhost:8000"
```

Use the PostgreSQL password configured in the previous step. URL-encode special characters when placing it in `DATABASE_URL`.

Generate each secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Choose a seed password of at least 12 characters that satisfies the application's password policy.

For an initial local demo, keep SMTP fields blank and weekly reports disabled.

### 5. Configure the Frontend

Set `frontend/.env`:

```dotenv
API_PROXY_TARGET=http://127.0.0.1:3000
VITE_API_BASE_URL=
```

A blank `VITE_API_BASE_URL` uses the same-origin development proxy.

### 6. Initialize the Development Database

```bash
cd backend-api
npx prisma generate
npx prisma db push
npm run seed
cd ..
```

Use `prisma db push` only for a fresh development database. Review migration history before changing a shared or production database.

### 7. Start the Application

Backend terminal:

```bash
npm run dev:api
```

Frontend terminal:

```bash
npm run dev:web
```

Open:

```text
http://localhost:5173
```

## Development Login Accounts

The password for these accounts is the `SEED_TEST_PASSWORD` configured when the seed was run.

| Role | Email |
| --- | --- |
| Administrator | `admin@hope.dev` |
| Coordinator | `coordinator@hope.dev` |
| Mentor | `mentor@hope.dev` |
| Faculty | `faculty@hope.dev` |
| Trainer | `trainer@hope.dev` |
| Student | `student@hope.dev` |

Sign out and sign in with another account to test another role.

## Run the Built Application

Set the backend's `FRONTEND_URL` to `http://localhost:3000`, then run:

```bash
npm run build
npm start
```

Open:

```text
http://localhost:3000
```

Express serves the built frontend and API together. The worker and ML service must be started separately.

## Optional Background Worker

Configure SMTP for actual email delivery, then run:

```bash
npm run build --prefix backend-api
PORT=3001 npm run start:worker --prefix backend-api
```

The worker needs the same database and Redis configuration as the API.

Use a different port from the API. Keep worker `/internal/scheduler/*` endpoints private because their deployment design relies on infrastructure access controls.

## Optional ML Service

```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

On Windows PowerShell, activate with:

```powershell
.venv\Scripts\Activate.ps1
```

Update `ml-service/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:55432/hope_platform
MODEL_DIR=./models
NODE_API_URL=http://localhost:3000
PORT=8000
```

Do not include Prisma's `?schema=public` parameter in the Python database URL.

Start the service:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Check:

```text
http://localhost:8000/health
```

Inspect `modelReady` in the response. Mentor alerts also require compatible database tables.

## Useful URLs

| Service | URL |
| --- | --- |
| Development frontend | http://localhost:5173 |
| Built application | http://localhost:3000 |
| Backend health | http://localhost:3000/health |
| Swagger documentation | http://localhost:3000/api-docs |
| ML health | http://localhost:8000/health |

## Verification

Build the application:

```bash
npm run build
```

Run backend tests against a suitable test environment:

```bash
npm test --prefix backend-api -- --runInBand
```

Run the login/profile smoke test with the API running against a seeded development database:

```bash
export SEED_TEST_PASSWORD='your-configured-development-password'
npm run test:smoke
```

The smoke test covers six-role login/profile behavior, not every feature. It performs updates and creates audit records.

The historical verification report at `docs/MERGE_VERIFICATION.md` records successful builds and selected workflows, alongside backend test failures. Those results are historical and should not be presented as a fresh passing test run.

## Current Limitations

- Not all workflows have been independently verified end-to-end.
- SMTP, Google Drive, and ML require separate configuration.
- Weekly reports have backend endpoints but no dedicated frontend page.
- Bulk user CSV import exists at `POST /admin/users/bulk-csv`, but the active user-management page has no upload form.
- User import does not automatically populate assessment results or batch membership.
- Some backend event-management operations are not exposed in the active frontend.
- The small trainer QR popup uses an outdated route; use fullscreen QR.
- Demo ML predictions are not validated for real student-risk decisions.
- Empty dashboards may indicate missing data, missing assignments, or service errors.

## Troubleshooting

| Issue | What to check |
| --- | --- |
| Backend does not start | Required environment variables and PostgreSQL/Redis connectivity |
| Login fails | Seeded database, active account, and password used during seeding |
| Page is unauthorized | Role permissions and student/batch assignments |
| Frontend API requests fail | Backend port, `API_PROXY_TARGET`, and `FRONTEND_URL` |
| Emails do not arrive | SMTP configuration and running worker |
| Proof upload fails | Drive credentials, folder access, file type, and size |
| ML or alerts are unavailable | Python service, database tables, model readiness, and `ML_SERVICE_URL` |
| Camera does not open | Browser camera permission and HTTPS |
| QR check-in fails | Fullscreen QR, reachable URL, active window, current token, and network rules |
| Background jobs remain queued | Worker process and shared Redis configuration |

## Project Structure

| Directory | Purpose |
| --- | --- |
| `frontend/` | Active React frontend |
| `backend-api/` | API, database schema, seed, tests, and workers |
| `ml-service/` | Python risk and mentor-alert service |
| `database/` | Database-related assets |
| `infra/` | Deployment configurations |
| `scripts/` | Setup and verification scripts |
| `docs/` | Technical documentation |
| `reference/backend-original-frontend/` | Archived frontend reference, excluded from the active build |

## Additional Documentation

- [API Documentation](docs/API.md)
- [Merge Verification](docs/MERGE_VERIFICATION.md)
- [Railway Backend Deployment](docs/RAILWAY_DEPLOYMENT.md)
- [Railway Frontend Deployment](docs/RAILWAY_FRONTEND.md)
- [Profile Module](docs/TICKET_5_PROFILE.md)
