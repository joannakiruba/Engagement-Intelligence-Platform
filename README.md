# **HOPE Engagement Intelligence Platform — Improved Development Plan**

**Delivery Date:** October 9  
**Development + Testing Window:** 3 weeks (Sept 18 – Oct 8)  
**Team Size:** 10 members | **Module Cap:** 20 core modules (MVP)  
**Team Leads:** Tisha Angel - Team 1 lead ·  Meenakshi - Team 2 lead

---

## **1. Users**

| **Role** | **Purpose on Platform** |
| --- | --- |
| **HOPE Student** | Attends training, submits proofs, tracks own progress, receives interventions |
| **Trainer** | Delivers sessions, gives feedback, marks attendance/assessments |
| **Faculty** | Oversees academic-side performance, views engagement data |
| **Mentor** | Receives risk alerts, runs interventions, logs outcomes |
| **Placement Coordinator** | Tracks placement-readiness, hackathon prep, event registration |
| **Program Administrator** | Manages batches, roles, permissions, system-wide config |

---

## **2. Requirements Mapped to Features**

**Mandatory:** Batch/session mgmt · Attendance & assessment performance · Training history · Trainer feedback · Engagement dashboard · Risk categories · AI weakness analysis · Mentor intervention workflow

**Strong:** Weekly multi-signal risk analysis · Trend/decline detection · Automated mentor alerts · Intervention follow-up · Department/batch comparison · Reason-coded outcomes

**Advanced:** Placement-readiness integration · Predictive disengagement · Personalized training recommendations · Trainer-effectiveness analytics

**From HOPE in-charge (folded into modules below):** Event registration · Proof/certification submission · Hackathon-prep reminders · Strict, unfakeable 8:05 AM attendance cutoff · Flexible tracking for different learning types/speeds · Weekly high-achiever promotion · Self-set schedules with fixed hard deadlines · Room for future extension

**Risk-engine logic (from the mandated agentic workflow):** every risk/intervention module must follow *Review signals → Detect pattern → Identify causes → Recommend intervention → Create mentor task → Track response → Reassess* — not a single LLM call, but a stateful agent that acts on data and verifies outcomes.

---

## **3. Improved Timeline (3 Weeks)**

### **Phase Breakdown**

| **Week** | **Dates** | **Theme** | **Deliverable** |
| --- | --- | --- | --- |
| **Week 1** | Sep 18 – Sep 24 | **Foundation Layer** | Working auth, database schema, core data capture (attendance, assessments, feedback) deployed and testable |
| **Week 2** | Sep 25 – Oct 1 | **Intelligence & Workflow Layer** | Dashboard operational, rule-based risk detection running, mentor intervention workflow functional |
| **Week 3** | Oct 2 – Oct 8 | **Polish, Security & Integration** | Full security audit, end-to-end testing, API documentation, deployment pipeline, demo environment |
| **Oct 9** | — | **Delivery** | Final presentation and handoff |

### **Weekly Milestones & PR Approval Gates**

**End of Week 1 (Sept 24):**
- ✅ All authentication working (login for all 6 roles)
- ✅ Database schema finalized and migrated
- ✅ Attendance, assessment, feedback capture functional
- ✅ API documentation published (Swagger)
- **PR Review:** Joanna + Jaya review all Week 1 code, merge to `main`

**End of Week 2 (Oct 1):**
- ✅ Engagement dashboard showing real data
- ✅ Risk categorization engine operational
- ✅ Mentor alert system sending notifications
- ✅ Intervention workflow (create/assign/track) complete
- **PR Review:** Joanna + Jaya review all Week 2 code, merge to `main`

**End of Week 3 (Oct 8):**
- ✅ Security hardening complete (penetration tests passed)
- ✅ All E2E tests passing
- ✅ Deployment pipeline functional
- ✅ Demo data loaded, system ready for presentation
- **Final PR Review:** Full team code review session

---

## **4. Tech Stack (Clarified & Fixed)**

### **Frontend**
- **Framework:** React 18+ with TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Context API (auth) + TanStack Query (server state)
- **Routing:** React Router v6
- **Forms:** React Hook Form + Zod validation
- **HTTP Client:** Axios
- **UI Components:** Headless UI (modals, dropdowns)

### **Backend**
- **Core API:** Node.js 20+ with Express.js
- **Auth:** JWT (access tokens) + Refresh tokens stored in HTTP-only cookies
- **Validation:** Joi (request validation middleware)
- **ORM:** Prisma (for PostgreSQL)
- **API Documentation:** Swagger UI + OpenAPI 3.0 spec

### **AI/ML Service**
- **Framework:** Python 3.11+ with FastAPI
- **ML Libraries:** scikit-learn (risk scoring), pandas, numpy
- **Task Queue:** None initially (direct HTTP calls from Node.js API)
- **Future:** LangChain/LlamaIndex for advanced weakness analysis (Phase 2)

### **Database**
- **Primary Database:** PostgreSQL 15+ (handles ALL data including text feedback, notes)
- **Schema Migration:** Prisma Migrate
- **Why no MongoDB?** Postgres JSONB handles unstructured data; one DB = simpler ops

### **File Storage**
- **Provider:** AWS S3 (or MinIO for local dev)
- **Upload Strategy:** Pre-signed URLs (client uploads directly to S3)
- **Validation:** File type whitelist, 10MB size limit, virus scan via ClamAV (Week 3)

### **Real-time & Background Jobs**
- **Notifications:** BullMQ (Redis-backed job queue) for mentor alerts, reminders
- **Why not WebSockets?** Polling sufficient for MVP; WebSockets in Phase 2 if needed

### **DevOps**
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions (lint, test, build, deploy)
- **Hosting:** Single VPS initially (separate containers for API, ML service, DB)
- **Monitoring:** PM2 for process management, basic logging to files

### **Testing**
- **Backend Unit:** Jest + Supertest
- **ML Service:** Pytest
- **Frontend Unit:** Vitest + React Testing Library
- **E2E:** Playwright (critical paths only: login, attendance, create intervention)

---

## **5. Module Breakdown (20 Core Modules)**

### **Week 1 — Foundation Layer (Modules 1-9)**

| **#** | **Module** | **Owner(s)** | **Description** | **Dependencies** |
| --- | --- | --- | --- | --- |
| **1** | **Database Schema Design** | Jaya Prathiba + Joanna Kiruba | Design full Prisma schema: users, roles, permissions, batches, sessions, attendance, assessments, feedback, interventions, events, proofs. Must be reviewed and finalized by Day 2. | None (blocks all other modules) |
| **2** | **Auth & RBAC Core** | Prazilla Pearl + Prisha Aditi | JWT auth, refresh tokens, login/logout endpoints, role-permission middleware for all 6 roles. Seed script for test users. | Module 1 (schema) |
| **3** | **User & Role Management** | Prisha Aditi | CRUD APIs for students, trainers, faculty, mentors, coordinators, admins. Profile view/edit. | Module 1, 2 |
| **4** | **Batch & Session Management** | Pon Swetha | Create/edit batches, assign trainers, schedule sessions, view batch roster. | Module 1, 2 |
| **5** | **Attendance Module** | Sree Harini + Harinee S (may be reassigned) | Server-time-locked check-in (closes 8:05 AM), prevents tampering. QR code scan or manual entry. Export attendance reports. | Module 1, 2, 4 |
| **6** | **Assessment & Performance Capture** | Meenakshi | Ingest marks, coding test scores, contest results, assignments. Supports bulk CSV upload. | Module 1, 2, 4 |
| **7** | **Training History Module** | Ayesha Siddiqa | Chronological log of sessions attended, topics covered, scores over time. Student-facing timeline view. | Module 1, 2, 4, 6 |
| **8** | **Trainer Feedback Module** | Tisha Angel | Structured feedback form (effort rating, participation, notes) per student per session. Searchable feedback history. | Module 1, 2, 4 |
| **9** | **API Documentation & Seed Data** | Joanna Kiruba | Swagger UI setup for all APIs. Seed data generator (50 students, 10 sessions, 200 attendance records, 100 assessments, 50 feedback entries) for testing. | Module 2-8 |

**Week 1 Goal:** By Sept 24, any team member can log in, mark attendance, enter assessments, submit feedback, and see data via API calls (Postman/Swagger).

---

### **Week 2 — Intelligence & Workflow Layer (Modules 10-16)**

| **#** | **Module** | **Owner(s)** | **Description** | **Dependencies** |
| --- | --- | --- | --- | --- |
| **10** | **Engagement Dashboard (Backend API)** | Joanna Kiruba + Pon Swetha | API endpoints for student engagement summary: attendance %, avg assessment score, recent feedback, training history. Supports filtering by batch, date range. | Module 5, 6, 7, 8 |
| **11** | **Engagement Dashboard (Frontend)** | Pon Swetha + Sree Harini | React dashboard showing per-student engagement cards, trend charts (attendance over time, score progression). Role-based views (students see only their own, mentors see assigned students). | Module 10 |
| **12** | **Rule-Based Risk Categorization** | Jaya Prathiba + Meenakshi | Python service that calculates risk score (0-100) using rules: attendance < 75% → +20 risk, avg score < 50% → +25 risk, negative feedback → +15 risk. Categorizes: Low (0-30), Medium (31-60), High (61-100). Runs daily via cron. | Module 5, 6, 8 |
| **13** | **Weekly Risk Analysis Report** | Jaya Prathiba | Automated weekly report: list all high-risk students, flagged reasons (low attendance, poor scores, negative feedback), trend comparison (better/worse than last week). Email to mentors. | Module 12 |
| **14** | **Mentor Alert System** | Harinee S + Ayesha Siddiqa | BullMQ job queue: when student crosses high-risk threshold, create alert job → send email + in-app notification to assigned mentor. Alert includes student summary and suggested actions. | Module 12 |
| **15** | **Intervention Workflow (Backend)** | Tisha Angel + Prazilla Pearl | APIs to create intervention (assign to mentor, set deadline, add notes), update status (pending/in-progress/completed), log outcome (improved/no change/declined), attach reason codes. | Module 1, 2, 12 |
| **16** | **Intervention Workflow (Frontend)** | Prazilla Pearl + Prisha Aditi | Mentor dashboard: view assigned interventions, mark complete, add outcome notes. Notification badge for pending interventions. Student view: see interventions assigned to them (read-only). | Module 15 |

**Week 2 Goal:** By Oct 1, mentors can log in, see high-risk students on dashboard, receive alerts, create interventions, and track outcomes.

---

### **Week 3 — Polish, Security & Integration (Modules 17-20)**

| **#** | **Module** | **Owner(s)** | **Description** | **Dependencies** |
| --- | --- | --- | --- | --- |
| **17** | **Event Registration & Proof Submission** | Sree Harini + Pon Swetha | Students register for hackathons/events. Upload proof documents (PDFs, images) to S3. Trainer/coordinator approves proofs. Dashboard shows upcoming events and deadlines. | Module 1, 2 |
| **18** | **Weekly High-Achiever Leaderboard** | Ayesha Siddiqa + Harinee S | Displays top 10 students per batch based on: attendance (30%), avg assessment (50%), contest participation (20%). Updates every Monday. Public view for motivation. | Module 5, 6, 17 |
| **19** | **Security Hardening & Audit Logging** | Joanna Kiruba + Jaya Prathiba | Input validation on all endpoints (Joi schemas), SQL injection tests, XSS prevention, rate limiting (express-rate-limit), CORS config. Audit log table: tracks all attendance edits, intervention changes, admin actions. | All modules |
| **20** | **Integration Testing & Deployment Pipeline** | All team members (pair sessions) | E2E Playwright tests for: login flow, mark attendance, create intervention, upload proof. GitHub Actions CI: lint → test → build Docker images → deploy to staging. Load test with 100 concurrent users. | All modules |

**Week 3 Goal:** By Oct 8, system is production-ready with security validated, all tests passing, deployed to staging environment, demo data loaded.

---

## **6. Module Dependency Graph**

```
CRITICAL PATH (must be completed in order):

Week 1:
Module 1 (DB Schema) [Day 1-2]
    ↓
Module 2 (Auth & RBAC) [Day 2-4]
    ↓
Module 4 (Batch Mgmt) [Day 3-5]
    ↓
Modules 5, 6, 7, 8 (Data Capture) [Day 4-7] — can run in parallel
    ↓
Module 9 (API Docs & Seed Data) [Day 6-7]

Week 2:
Module 10 (Dashboard Backend) [Day 8-10]
    ↓
Module 11 (Dashboard Frontend) [Day 10-12]

Module 12 (Risk Categorization) [Day 8-10] — parallel to Module 10
    ↓
Module 13 (Weekly Risk Report) [Day 11-12]
    ↓
Module 14 (Mentor Alerts) [Day 11-13]

Modules 15, 16 (Intervention Workflow) [Day 11-14] — parallel to Modules 13-14

Week 3:
Module 17 (Events & Proofs) [Day 15-17] — independent, can start anytime
Module 18 (Leaderboard) [Day 16-18] — depends on Modules 5, 6
Module 19 (Security) [Day 15-20] — reviews all code
Module 20 (Testing & Deploy) [Day 18-21] — final integration
```

**Visual Dependency Flow:**
```
         [1: DB Schema]
               ↓
         [2: Auth/RBAC]
               ↓
    ┌──────────┼──────────┐
    ↓          ↓          ↓
[3: Users] [4: Batches] [9: API Docs]
               ↓
    ┌──────────┼──────────┬──────────┐
    ↓          ↓          ↓          ↓
[5: Attend] [6: Assess] [7: History] [8: Feedback]
    └──────────┼──────────┴──────────┘
               ↓
    ┌──────────┴──────────┐
    ↓                     ↓
[10: Dashboard API]  [12: Risk Engine]
    ↓                     ↓
[11: Dashboard UI]   [13: Risk Report]
                          ↓
                     [14: Alerts]
                          ↓
                   [15: Intervention API]
                          ↓
                   [16: Intervention UI]
               ┌──────────┴──────────┐
               ↓                     ↓
          [17: Events]         [18: Leaderboard]
               └──────────┬──────────┘
                          ↓
                   [19: Security]
                          ↓
                  [20: Testing & Deploy]
```

---

## **7. Team Member Assignments**

| **Member** | **Specialty** | **Year** | **Primary Modules** | **Support Modules** |
| --- | --- | --- | --- | --- |
| **Jaya Prathiba** | AI/ML | 2nd | 1 (DB Schema), 12 (Risk Engine), 13 (Risk Report), 19 (Security lead) | Code review for all ML modules |
| **Joanna Kiruba** | Fullstack | 3rd | 1 (DB Schema), 9 (API Docs), 10 (Dashboard API), 19 (Security lead) | Integration lead, PR reviews |
| **Meenakshi** | AI/ML | 3rd | 6 (Assessment Capture), 12 (Risk Engine) | ML model validation |
| **Ayesha Siddiqa** | AI/ML | 3rd | 7 (Training History), 14 (Mentor Alerts), 18 (Leaderboard) | Data analysis support |
| **Pon Swetha** | Fullstack | 2nd | 4 (Batch Mgmt), 10 (Dashboard API), 11 (Dashboard UI), 17 (Events) | Frontend component library |
| **Sree Harini** | AI/ML | 2nd | 5 (Attendance), 11 (Dashboard UI), 17 (Events) | Frontend testing |
| **Harinee S** | Fullstack | 2nd | 5 (Attendance logic), 14 (Mentor Alerts), 18 (Leaderboard) | Risk scoring validation |
| **Prazilla Pearl** | ML/Fullstack | 2nd | 2 (Auth & RBAC), 15 (Intervention API), 16 (Intervention UI) | Bridge between backend/frontend |
| **Tisha Angel** | AI/ML | 3rd | 8 (Trainer Feedback), 15 (Intervention API) | Feedback text analysis (future) |
| **Prisha Aditi** | ML/Fullstack | 2nd | 2 (Auth & RBAC), 3 (User Mgmt), 16 (Intervention UI) | Testing & QA support |

**Note:** Module 20 (Testing & Deployment) is a whole-team effort with rotating pair sessions in Week 3.

---

## **8. Coordination & Process**

### **Daily Standups (Async)**
- **Time:** Every morning by 9:30 AM
- **Format:** Post in team Slack/Discord:
  - ✅ Completed yesterday: [specific tasks]
  - 🎯 Today's goal: [module + specific feature]
  - 🚧 Blockers: [none / waiting on X / need help with Y]
- **Lead Review:** Joanna + Jaya read all standups by 10 AM, unblock if needed

### **Weekly Sprint Calls (Video)**
- **Day:** Every Monday 7:00 PM (Week 1: Sept 18, Week 2: Sept 25, Week 3: Oct 2)
- **Agenda:**
  1. Demo: Each member shows working feature (2 min each)
  2. Blockers discussion (10 min)
  3. Next week's priorities (5 min)
- **Documentation:** One designated note-taker per week (rotates), posts summary to Notion/Docs

### **Code Review Process**
1. Developer completes module → creates PR with description + screenshots/demo
2. Assigned reviewer (see table below) reviews within 24 hours
3. If approved → merge; if changes needed → fix and re-request review
4. **No self-merging** — even leads need a second pair of eyes

| **Module Type** | **Primary Reviewer** |
| --- | --- |
| Database/Schema | Jaya Prathiba |
| Backend API | Joanna Kiruba |
| Frontend UI | Pon Swetha |
| ML/Risk Engine | Jaya Prathiba |
| Auth/Security | Joanna + Prazilla |

### **Shared Resources (Set up Day 1)**
1. **GitHub Repo:** Branch naming: `module-<number>-<name>` (e.g., `module-2-auth-rbac`)
2. **Task Board:** GitHub Projects or Notion (columns: To Do, In Progress, In Review, Done)
3. **Slack/Discord Channels:**
   - `#general` — announcements
   - `#frontend` — React/UI questions
   - `#backend` — Node.js/API questions
   - `#ml-service` — Python/risk engine
   - `#blockers` — urgent help needed
4. **Shared Component Library (Frontend):** Create in Week 1 Day 1
   - `<Button>`, `<Input>`, `<Select>`, `<Modal>`, `<Card>`, `<Table>` components
   - Documented in Storybook or simple README
5. **API Contract Document:** Google Doc with all endpoints (method, path, request, response)
   - Finalized by end of Week 1 Day 3
   - Frontend can mock APIs and develop in parallel

### **Testing Strategy**
- **Unit Tests:** Each developer writes tests for their own module (min 70% coverage)
- **Integration Tests:** Week 2 Day 7 — test cross-module flows (e.g., mark attendance → risk score updates)
- **E2E Tests:** Week 3 — Playwright tests for critical user journeys
- **Load Testing:** Week 3 Day 6 — use `artillery` to simulate 100 concurrent users

### **Risk Mitigation**
- **Critical Module Alert:** If Module 1 or 2 is delayed → immediately escalate to leads
- **Backup Plan:** If any module is blocked, owner switches to Module 17 or 18 (independent modules)
- **Daily Check-ins with Mentor:** Leads report progress + blockers every evening

---

## **9. Directory Structure (Updated)**

```
hope-engagement-platform/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, test, build on PR
│       └── deploy.yml                # Deploy to staging/production
│
├── frontend/                         # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── shared/               # Button, Input, Modal, Table
│   │   │   ├── dashboard/            # DashboardCard, TrendChart
│   │   │   ├── interventions/        # InterventionForm, InterventionList
│   │   │   └── leaderboard/          # LeaderboardTable
│   │   ├── pages/
│   │   │   ├── auth/                 # Login, Register
│   │   │   ├── student/              # StudentDashboard, MyProgress, Events
│   │   │   ├── trainer/              # TrainerDashboard, GiveFeedback, MarkAttendance
│   │   │   ├── mentor/               # MentorDashboard, Interventions, Alerts
│   │   │   ├── faculty/              # FacultyDashboard, BatchComparison
│   │   │   ├── coordinator/          # CoordinatorDashboard, EventManagement
│   │   │   └── admin/                # AdminDashboard, UserManagement, BatchSetup
│   │   ├── hooks/                    # useAuth, useRBAC, useDebounce
│   │   ├── context/                  # AuthContext, ThemeContext
│   │   ├── services/                 # API client (axios instance, endpoints)
│   │   │   ├── api.ts                # Base axios config
│   │   │   ├── auth.service.ts
│   │   │   ├── attendance.service.ts
│   │   │   ├── dashboard.service.ts
│   │   │   └── interventions.service.ts
│   │   ├── utils/                    # formatDate, calculateRisk, etc.
│   │   ├── types/                    # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── backend-api/                      # Node.js + Express + Prisma
│   ├── src/
│   │   ├── auth/
│   │   │   ├── jwt.middleware.ts     # Verify JWT
│   │   │   ├── rbac.middleware.ts    # Check role permissions
│   │   │   └── auth.controller.ts    # Login, logout, refresh token
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── batches.routes.ts
│   │   │   ├── attendance.routes.ts
│   │   │   ├── assessments.routes.ts
│   │   │   ├── feedback.routes.ts
│   │   │   ├── interventions.routes.ts
│   │   │   ├── events.routes.ts
│   │   │   ├── proofs.routes.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   └── leaderboard.routes.ts
│   │   ├── controllers/              # Business logic for each route
│   │   ├── services/
│   │   │   ├── ml.service.ts         # Calls to Python ML service
│   │   │   ├── email.service.ts      # Send mentor alerts
│   │   │   └── s3.service.ts         # Generate pre-signed URLs
│   │   ├── jobs/
│   │   │   ├── queue.ts              # BullMQ setup
│   │   │   ├── alert.job.ts          # Mentor alert job
│   │   │   └── weekly-report.job.ts  # Weekly risk report
│   │   ├── middleware/
│   │   │   ├── validate.middleware.ts  # Joi validation
│   │   │   ├── error.middleware.ts     # Global error handler
│   │   │   ├── audit.middleware.ts     # Log all write operations
│   │   │   └── rate-limit.middleware.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   └── response.ts           # Standardized API responses
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Full database schema
│   │   │   ├── seed.ts               # Seed data generator
│   │   │   └── migrations/
│   │   ├── config/
│   │   │   └── index.ts              # Environment variables
│   │   ├── swagger/
│   │   │   └── swagger.json          # OpenAPI spec
│   │   └── server.ts                 # Express app entry point
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── ml-service/                       # Python + FastAPI
│   ├── app/
│   │   ├── main.py                   # FastAPI entry point
│   │   ├── risk_engine/
│   │   │   ├── __init__.py
│   │   │   ├── calculator.py         # Rule-based risk scoring
│   │   │   ├── categorizer.py        # Low/Medium/High classification
│   │   │   └── trend_detector.py     # Week-over-week comparison
│   │   ├── models/
│   │   │   ├── risk_request.py       # Pydantic models for API
│   │   │   └── risk_response.py
│   │   ├── routes/
│   │   │   ├── risk.py               # POST /calculate-risk
│   │   │   └── health.py             # GET /health
│   │   ├── utils/
│   │   │   └── logger.py
│   │   └── config.py
│   ├── tests/
│   │   └── test_risk_engine.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── database/
│   ├── postgres/
│   │   └── init.sql                  # Initial setup (if not using Prisma Migrate)
│   └── redis/
│       └── redis.conf                # BullMQ queue config
│
├── infra/
│   ├── docker-compose.yml            # Local development setup (postgres, redis, api, ml, frontend)
│   ├── docker-compose.prod.yml       # Production setup
│   └── nginx/
│       └── nginx.conf                # Reverse proxy config
│
├── docs/
│   ├── API.md                        # API endpoint documentation
│   ├── SETUP.md                      # Development environment setup
│   ├── TESTING.md                    # Testing guidelines
│   ├── sprint-notes/
│   │   ├── week1-sept18.md
│   │   ├── week2-sept25.md
│   │   └── week3-oct2.md
│   └── module-tickets/
│       ├── module-01-db-schema.md
│       ├── module-02-auth-rbac.md
│       └── ...
│
├── scripts/
│   ├── setup-dev.sh                  # One-command dev setup
│   └── load-test.sh                  # Artillery load testing script
│
├── .gitignore
├── README.md                         # Original requirements doc
├── improved_workflow.md              # This file
└── package.json                      # Root package.json (monorepo scripts)
```

---

## **10. Security Checklist (Module 19)**

| **Category** | **Implementation** | **Owner** |
| --- | --- | --- |
| **Input Validation** | Joi schemas on all POST/PUT endpoints, reject unexpected fields | Joanna |
| **SQL Injection** | Prisma ORM (parameterized queries), no raw SQL | Joanna |
| **XSS Prevention** | React auto-escapes, DOMPurify for user-generated HTML | Pon Swetha |
| **CSRF Protection** | SameSite=Strict cookies, CSRF tokens on state-changing ops | Prazilla |
| **Rate Limiting** | 100 req/15min per IP on auth endpoints, 1000 req/15min on read endpoints | Joanna |
| **CORS** | Whitelist frontend domain only | Joanna |
| **Secrets Management** | `.env` files (gitignored), AWS Secrets Manager in prod | Jaya |
| **Password Hashing** | bcrypt with 10 rounds | Prazilla |
| **Audit Logging** | Log all attendance edits, intervention changes, admin actions to `audit_logs` table | Joanna |
| **File Upload Security** | Whitelist extensions (pdf, jpg, png), 10MB limit, ClamAV scan (Week 3) | Sree Harini |
| **Attendance Tampering** | Server-time-only, no client timestamp accepted, closed at 8:05 AM sharp | Sree Harini |

---

## **11. Testing Strategy**

### **Unit Tests (70% Coverage Minimum)**
- **Backend:** Jest + Supertest — test each route, controller, service
- **ML Service:** Pytest — test risk calculation logic with known inputs
- **Frontend:** Vitest + React Testing Library — test components, hooks

### **Integration Tests**
- **Scenario 1:** Mark attendance → verify attendance record created → check risk score updated
- **Scenario 2:** Create intervention → verify mentor receives alert → mentor marks complete → verify outcome logged
- **Scenario 3:** Upload proof → trainer approves → verify S3 file exists and DB updated

### **E2E Tests (Playwright)**
- **Test 1:** Student logs in → views dashboard → sees attendance, marks, upcoming events
- **Test 2:** Trainer logs in → marks attendance for batch → submits feedback
- **Test 3:** Mentor logs in → sees high-risk alert → creates intervention → marks complete
- **Test 4:** Admin logs in → creates new batch → assigns trainer → verifies batch appears in trainer's view

### **Load Testing (Artillery)**
- **Scenario:** 100 concurrent users logging in, viewing dashboard, marking attendance
- **Goal:** < 500ms response time for 95th percentile, no errors

---

## **12. Deployment Pipeline**

### **Environments**
1. **Local Development:** `docker-compose up` (runs all services on localhost)
2. **Staging:** Deployed on VPS (staging.hope-platform.example.com) after Week 2
3. **Production:** Deployed on Oct 9 after final testing

### **GitHub Actions Workflow**
```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  backend-test:
    - npm install
    - npm run lint
    - npm run test
    - npm run build
  
  ml-service-test:
    - pip install -r requirements.txt
    - pytest
  
  frontend-test:
    - npm install
    - npm run lint
    - npm run test
    - npm run build
  
  deploy-staging:
    if: github.ref == 'refs/heads/main'
    - Build Docker images
    - Push to registry
    - SSH to staging server
    - docker-compose pull && docker-compose up -d
```

---

## **13. Deferred to Phase 2 (Post Oct 9)**

The following advanced modules are intentionally **excluded** from MVP to ensure realistic timeline:

| **Module** | **Reason for Deferral** | **Estimated Future Effort** |
| --- | --- | --- |
| Predictive disengagement (ML model) | Needs 2-3 months of historical data to train | 2 weeks |
| AI-assisted weakness analysis (NLP) | Requires LLM integration, prompt engineering | 1 week |
| Trainer-effectiveness analytics | Needs controlled experiments, statistical analysis | 1 week |
| Personalized training recommendations | Needs content database, recommendation algorithm | 2 weeks |
| Department/batch comparison analytics | Complex queries, visualization, not core to intervention workflow | 1 week |
| WebSocket real-time updates | Polling sufficient for MVP | 3 days |
| Mobile app (React Native) | Desktop-first approach, mobile later | 3 weeks |
| Advanced biometrics (face recognition for attendance) | Tampering prevention sufficient for now | 2 weeks |

**Total Deferred Effort:** ~10 weeks (can be spread over 2-3 months post-launch)

---

## **14. Success Metrics (Demo Day Oct 9)**

**Must-Have Demos:**
1. ✅ All 6 roles can log in with appropriate permissions
2. ✅ Trainer marks attendance (strict 8:05 AM cutoff enforced)
3. ✅ Student views their engagement dashboard (attendance %, scores, feedback)
4. ✅ System calculates risk score for all students (rule-based)
5. ✅ Mentor receives alert for high-risk student
6. ✅ Mentor creates intervention and logs outcome
7. ✅ Weekly high-achiever leaderboard displays correctly
8. ✅ Student uploads event proof, coordinator approves
9. ✅ Admin creates new batch and assigns trainer
10. ✅ Security audit shows no critical vulnerabilities

**Nice-to-Have Demos:**
- Weekly risk report email sent to mentors
- Load test shows system handles 100 concurrent users
- Mobile-responsive UI works on tablet

---

## **15. Communication Protocols**

### **Escalation Path**
1. **Blocked on technical issue** → Post in relevant Slack channel (e.g., `#backend`)
2. **No response in 2 hours** → DM the team lead (Joanna for fullstack, Jaya for ML)
3. **Still blocked after 4 hours** → Escalate to mentor

### **Meeting with Mentor (Daily)**
- **Time:** Every evening 8:00 PM (15-minute call)
- **Attendees:** Joanna + Jaya (leads only)
- **Format:**
  - Today's completed modules
  - Tomorrow's priorities
  - Blockers requiring mentor guidance

### **Emergency Protocol**
- **Definition:** Module 1 or 2 delayed beyond Day 2, or critical security vulnerability found
- **Action:** Immediate team-wide video call, reassign resources, consider scope cut

---

## **16. Tools & Resources**

| **Category** | **Tool** | **Purpose** |
| --- | --- | --- |
| **Code Hosting** | GitHub | Version control, PR reviews |
| **Task Management** | GitHub Projects or Notion | Kanban board, ticket tracking |
| **Communication** | Slack or Discord | Team chat, standups |
| **API Testing** | Postman or Thunder Client | Manual API testing |
| **Database GUI** | DBeaver or pgAdmin | Inspect Postgres data |
| **Design** | Figma or Excalidraw | Quick UI mockups (optional) |
| **Documentation** | Notion or Google Docs | Sprint notes, meeting minutes |
| **CI/CD** | GitHub Actions | Automated testing, deployment |
| **Monitoring** | PM2 + Winston logs | Process management, error tracking |

---

## **17. Pre-Work (Before Sept 18)**

**All Team Members:**
- [ ] Join GitHub repo (accept invite)
- [ ] Set up local dev environment: Node.js 20+, Python 3.11+, Docker, Postgres, Redis
- [ ] Clone repo and run `docker-compose up` (once set up by leads)
- [ ] Read this document fully
- [ ] Add your availability (hours per day) to team planning doc

**Leads Only (Joanna + Jaya):**
- [ ] Set up GitHub repo with branch protection rules
- [ ] Create initial `docker-compose.yml` with postgres, redis, API skeleton, ML skeleton
- [ ] Set up Slack/Discord workspace with channels
- [ ] Create task board (GitHub Projects) with all 20 modules as issues
- [ ] Draft initial Prisma schema outline (finalize in Module 1)

---

## **Final Notes**

- This is a **realistic, achievable plan** for a 3-week deadline with 10 team members.
- **Focus:** Core engagement tracking + rule-based risk detection + intervention workflow (no advanced ML yet).
- **Phase 2 (post-Oct 9):** Add predictive models, advanced analytics, mobile app after collecting real data.
- **Key to success:** Daily communication, strict dependency management, immediate escalation of blockers.
- **Remember:** It's okay to say "I'm stuck" early — waiting until the last day is how projects fail.

**Let's build something great! 🚀**
