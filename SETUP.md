# Engagement Intelligence Platform — Setup Guide

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | 18+ | `node -v` |
| **npm** | 9+ | `npm -v` |
| **Python** | 3.10+ | `python3 --version` |
| **PostgreSQL** | 14+ | `psql --version` |
| **Redis** | 6+ | `redis-cli ping` |
| **Git** | 2.30+ | `git --version` |

---

## 1. Clone the Repository

```bash
git clone https://github.com/joannakiruba/Engagement-Intelligence-Platform.git
cd Engagement-Intelligence-Platform
git checkout frontend-demo
```

---

## 2. Set Up PostgreSQL

Create a database and user:

```bash
sudo -u postgres psql
```

```sql
CREATE USER hope_user WITH PASSWORD 'hope_pass_2026';
CREATE DATABASE hope_platform OWNER hope_user;
GRANT ALL PRIVILEGES ON DATABASE hope_platform TO hope_user;
\q
```

---

## 3. Start Redis

```bash
# Ubuntu/Debian
sudo systemctl start redis-server

# macOS (Homebrew)
brew services start redis

# Verify
redis-cli ping
# Should print: PONG
```

---

## 4. Backend API Setup

```bash
cd backend-api
```

### 4a. Install dependencies

```bash
npm install
```

### 4b. Create environment file

```bash
cp .env.example .env
```

Edit `.env` and update at minimum:

```env
DATABASE_URL="postgresql://hope_user:hope_pass_2026@localhost:5432/hope_platform?schema=public"
JWT_SECRET="any-random-string-at-least-32-characters-long"
TOKEN_HASH_SECRET="another-random-string-at-least-32-chars"
SEED_TEST_PASSWORD="HopeTest2026!@dev"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

> SMTP and Google Drive settings are optional for local demo. Leave the defaults if you don't need email or file uploads.

### 4c. Run database migrations

```bash
npx prisma migrate dev
```

This creates all tables. If prompted for a migration name, just press Enter.

### 4d. Generate Prisma client

```bash
npx prisma generate
```

### 4e. Seed the database

```bash
npm run seed
```

This creates demo users for every role (admin, coordinator, mentor, faculty, trainer, student) with the password set in `SEED_TEST_PASSWORD`.

### 4f. Start the backend

```bash
npm run dev
```

The backend starts on **http://localhost:3000**. You should see log output confirming the server is running. Leave this terminal open.

### 4g. Verify backend is running

Open a new terminal:

```bash
curl http://localhost:3000/api-docs
```

This should return the Swagger UI HTML.

---

## 5. ML Service Setup (Optional)

The ML service provides risk scoring and mentor alert generation. The platform works without it (risk calculations fall back to rule-based scoring), but for the full demo:

```bash
cd ml-service
```

### 5a. Create a Python virtual environment

```bash
python3 -m venv venv
source venv/bin/activate   # Linux/macOS
# venv\Scripts\activate    # Windows
```

### 5b. Install dependencies

```bash
pip install -r requirements.txt
```

### 5c. Set environment variables

```bash
export DATABASE_URL="postgresql://hope_user:hope_pass_2026@localhost:5432/hope_platform"
export NODE_API_URL="http://localhost:3000"
export PORT=8000
```

Or create a `.env` file in `ml-service/`:

```env
DATABASE_URL="postgresql://hope_user:hope_pass_2026@localhost:5432/hope_platform"
NODE_API_URL="http://localhost:3000"
PORT=8000
```

### 5d. Start the ML service

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The ML service starts on **http://localhost:8000**. Leave this terminal open.

---

## 6. Frontend Setup

Open a new terminal:

```bash
cd frontend
```

### 6a. Install dependencies

```bash
npm install
```

### 6b. Start the dev server

```bash
npm run dev
```

The frontend starts on **http://localhost:5173**. The Vite dev server automatically proxies API requests to the backend at `localhost:3000`.

---

## 7. Access the Application

Open **http://localhost:5173** in your browser.

### Demo Login Credentials

All demo accounts use the password from `SEED_TEST_PASSWORD` (default: `HopeTest2026!@dev`):

| Role | Email |
|------|-------|
| Admin | `admin@hope.dev` |
| Coordinator | `coordinator@hope.dev` |
| Mentor | `mentor@hope.dev` |
| Faculty | `faculty@hope.dev` |
| Trainer | `trainer@hope.dev` |
| Student | `student@hope.dev` |

You can also switch between roles using the persona switcher in the top header bar.

---

## 8. Run Tests

### Backend tests

```bash
cd backend-api
npm test
```

### Frontend connectivity tests

```bash
cd frontend
npm test
```

This runs 92 tests verifying every frontend service function calls the correct backend API endpoint.

### ML service tests

```bash
cd ml-service
source venv/bin/activate
pytest
```

---

## 9. Project Structure

```
Engagement-Intelligence-Platform/
├── backend-api/          # Express + Prisma + PostgreSQL
│   ├── src/
│   │   ├── controllers/  # Route handlers
│   │   ├── middleware/    # Auth, RBAC, validation
│   │   ├── routes/       # API route definitions
│   │   ├── prisma/       # Schema, migrations, seed
│   │   └── server.ts     # Entry point (port 3000)
│   └── .env.example
├── frontend/             # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route pages (dashboard, attendance, etc.)
│   │   ├── services/     # API client functions
│   │   ├── context/      # AuthContext with RBAC
│   │   ├── constants/    # Role-permission mappings
│   │   ├── types/        # Shared TypeScript types
│   │   └── __tests__/    # Service connectivity tests
│   └── vite.config.ts    # Dev server + API proxy config
├── ml-service/           # Python FastAPI + scikit-learn
│   ├── app/
│   │   ├── risk_engine/  # ML model + rule-based scoring
│   │   ├── mentor_alerts/# Alert generation
│   │   └── main.py       # Entry point (port 8000)
│   └── requirements.txt
└── SETUP.md              # This file
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED :5432` | PostgreSQL isn't running. Start it: `sudo systemctl start postgresql` |
| `ECONNREFUSED :6379` | Redis isn't running. Start it: `sudo systemctl start redis-server` |
| Prisma migration fails | Make sure `DATABASE_URL` in `.env` matches your PostgreSQL credentials |
| Frontend shows network errors | Ensure the backend is running on port 3000 before starting the frontend |
| `bcrypt` build errors on install | Install build tools: `sudo apt install build-essential python3` (Linux) or `xcode-select --install` (macOS) |
| ML service `asyncpg` connection error | Verify `DATABASE_URL` uses the correct PostgreSQL credentials |
| Port already in use | Kill the existing process: `lsof -ti:PORT_NUMBER \| xargs kill` |
