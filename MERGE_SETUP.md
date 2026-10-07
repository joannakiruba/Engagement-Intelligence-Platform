# Run the combined project

## 1. Requirements

Node.js 20.19+ (tested with 20.19.4), npm, PostgreSQL 16 and Redis 7. Docker Compose is optional. Use a new development database for the first run.

From the extracted project root:

```bash
npm run install:all
cp backend-api/.env.example backend-api/.env
cp frontend/.env.example frontend/.env
```

Copy examples only if the destination files do not already exist. The archive contains no working credentials or real .env files.

## 2. Start PostgreSQL and Redis

If you already have these services, use their addresses in backend-api/.env. Otherwise, set LOCAL_DB_PASSWORD to a password of your choice in your terminal, then run:

```bash
docker compose -f compose.local.yml up -d
```

The compose file exposes PostgreSQL on localhost:55432 and Redis on localhost:56379, with named volumes. Stop with docker compose -f compose.local.yml down; omit -v to preserve data.

Edit backend-api/.env:

- DATABASE_URL: postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:55432/hope_platform?schema=public
- JWT_SECRET and TOKEN_HASH_SECRET: two different strong random secrets.
- SEED_TEST_PASSWORD: a development password meeting the backend policy (12+ characters; avoid common, sequential/repeated, name/email-derived passwords).
- REDIS_HOST=localhost and REDIS_PORT=56379 for the supplied compose file.
- PORT=3000; NODE_ENV=development.
- FRONTEND_URL=http://localhost:5173 for the Vite development server, or http://localhost:3000 when using the built frontend through the backend.
- Leave SMTP fields blank and WEEKLY_REPORT_ENABLED=false for an initial local demo. Local stream transport does not deliver emails.

## 3. Prepare a fresh development database

The upstream migration history is retained. For the disposable development database used in this integration, the current Prisma schema was applied directly:

```bash
cd backend-api
npx prisma generate
npx prisma db push
npm run seed
cd ..
```

Run db push only against your new development database. Do not apply it blindly to a shared or production database. Existing databases need their migration history checked and a migration plan; this package makes no schema changes.

Development seed accounts: admin@hope.dev, student@hope.dev, trainer@hope.dev, faculty@hope.dev, mentor@hope.dev, coordinator@hope.dev. Their password is the SEED_TEST_PASSWORD you configured. No automatic login is enabled.

## 4. Run the application

Development, in two terminals from the root:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open http://localhost:5173. Vite proxies /api, /auth and /users to port 3000. Change API_PROXY_TARGET in frontend/.env if your backend port differs. Leave VITE_API_BASE_URL blank for same-origin requests and refresh cookies.

Built application:

```bash
npm run build
npm start
```

Set FRONTEND_URL=http://localhost:3000 for this mode. Open http://localhost:3000; Swagger is at /api-docs. Built frontend deep links such as /admin/users and /profile are supported. This local built-mode check used NODE_ENV=development; public production deployment additionally needs HTTPS, production environment settings and configured external services.

## 5. External modules

- Weekly reports, notifications and email use Redis/BullMQ. Configure actual SMTP credentials before enabling delivery or scheduled reports. Production refuses unconfigured SMTP. Reports remain available through /api/weekly-reports; the supplied new UI has no dedicated weekly-report screen.
- Proof uploads use the backend Google Drive integration. Configure the three GOOGLE_DRIVE_* settings and appropriate folder permissions. Selecting a file now uploads multipart data to the actual backend; no fake Drive URL is generated.
- Mentor alerts and ML predictions require ml-service, its model and its database tables. Set ML_SERVICE_URL in the backend. The service's requirements and setup are upstream assets and were not verified end-to-end here. Without it, the UI reports service unavailability.
- Account activation/password recovery pages are preserved. Email-link delivery itself requires SMTP and Redis.

## 6. Verification commands

```bash
npm run build
npm test --prefix backend-api -- --runInBand
```

The full backend suite currently has existing failures on untouched main too; see docs/MERGE_VERIFICATION.md. To run the added real HTTP smoke test against your seeded development database, export SEED_TEST_PASSWORD in your terminal and run npm run test:smoke. Optionally set SMOKE_API_URL (default http://localhost:3000). This test logs in as all six seeded roles, saves the same profile values, checks safe responses and rejects forbidden profile fields. It creates audit records in the test database; use development data only.

## 7. Bringing this into GitHub

The ZIP is the complete combined source tree, not a changes-only archive. Review on a new branch based on backend commit 48b9e074368fe3c192568e0b5e3095c146f529e8. Preserve your existing .git and environment files. Use the separate merge patch if applying to that exact base: git apply --check first, then git apply. A newer main may require conflict resolution. Build and review the changes before committing or opening a PR. Neither upstream repository was changed remotely.
