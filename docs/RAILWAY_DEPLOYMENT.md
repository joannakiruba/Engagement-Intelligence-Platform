# Railway deployment from GitHub

The repository contains three deployable Railway services: `frontend`, `backend-api`, and `ml-service`. Each service has its own Dockerfile and Railway config. The API image can also run the existing background worker as a separate optional Railway service; deploy that worker to preserve queued email, alert, and scheduled-job processing.

The root package is an orchestration package, not an npm workspace: backend and frontend dependencies are installed from their own lockfiles. In particular, Prisma CLI is intentionally a backend build-time devDependency. Any build from the monorepo root must install `backend-api` dependencies with devDependencies included before invoking its Prisma script.

## Create GitHub-connected services

Create one Railway project connected to this GitHub repository and the same environment (for example, `production`). For each service, use the same repository and branch, then set:

| Service | Root directory | Config file | Public networking | Health check |
| --- | --- | --- | --- | --- |
| Frontend | `/frontend` | `/frontend/railway.json` | Public domain required | `/health` |
| Backend API | `/backend-api` | `/backend-api/railway.json` | Public domain required | `/health` |
| ML service | `/ml-service` | `/ml-service/railway.json` | Do not generate a public domain | `/health` |
| Worker (recommended) | `/backend-api` | `/backend-api/railway.worker.json` | Do not generate a public domain | `/health` |

Railway deploys each service on GitHub changes to the connected branch. The dashboard's root directory is a per-service setting; the source directories are isolated during builds. Railway currently marks `railway.json` config-as-code as deprecated and says newly created services cannot opt into it, so the JSON files in this repo document settings for legacy services; for new services, apply the same Dockerfile, health-check, restart, and worker start-command settings in each service's dashboard. The ML service should only be reachable through Railway private networking. Do not enable public networking for it.

For the API, the simplest supported build is root directory `/backend-api`, Dockerfile `Dockerfile`, and no custom build command. Its Dockerfile runs `npm ci --include=dev`, generates Prisma Client, compiles TypeScript, then prunes devDependencies from the runtime image. If you intentionally build from the repository root with Railpack, set the Build Command to `npm run railway:build:backend` (not the bare `npm run prisma:generate --prefix backend-api`).

## Configure environment variables

Create one PostgreSQL database and one Redis service (Railway-managed or external) in the same Railway environment, or use compatible external services. Configure the variables below in Railway's Variables tab. Do not commit real secrets.

### Backend API

Required:

- `NODE_ENV=production`
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — high-entropy secret
- `TOKEN_HASH_SECRET` — separate high-entropy secret
- `REDIS_URL` — Redis connection string
- `FRONTEND_URL=https://<frontend-domain>`
- `FRONTEND_URLS=https://<frontend-domain>` — semicolon-separated exact origins if multiple
- `ML_SERVICE_URL=http://${{ml-service.RAILWAY_PRIVATE_DOMAIN}}:${{ml-service.PORT}}`
- `ML_SERVICE_AUTH_MODE=none` — valid only while ML stays private on Railway

The API also needs `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, and `GOOGLE_DRIVE_FOLDER_ID` for email and proof storage. Set values for integrations actually used. Optional auth/worker settings include `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY_DAYS`, `JWT_REFRESH_ABSOLUTE_CEILING_DAYS`, `JWT_REFRESH_GRACE_WINDOW_SECONDS`, `ML_TIMEOUT_MS`, `WEEKLY_REPORT_ENABLED`, `WEEKLY_REPORT_DAY`, `WEEKLY_REPORT_HOUR`, and `WEEKLY_REPORT_TZ`.

`PORT` is supplied by Railway; the API reads it and defaults to 3000 locally. Do not set a fixed port unless you configure the same port for the service.

### Frontend

- `VITE_API_BASE_URL=https://${{backend-api.RAILWAY_PUBLIC_DOMAIN}}`

This is a public build-time value embedded in the browser bundle, not a secret. Changing it triggers a rebuild. Keep the API's `FRONTEND_URL` and `FRONTEND_URLS` synchronized to the final frontend origin(s).

### ML service

- `DATABASE_URL` — same PostgreSQL database connection string used by the backend
- `DB_POOL_MIN_SIZE=1`
- `DB_POOL_MAX_SIZE=5`
- `MODEL_DIR=./models` (optional; default)
- `ML_CORS_ORIGINS=` (leave empty; browser requests should not call the private service)

Railway provides `PORT`; the Dockerfile defaults to 8080 for local use. Include a trained `models/risk_model.joblib` artifact in the ML build if predictions must be ready; without it the service remains healthy but reports the model as unavailable.

### Worker service

Deploy the optional worker using the API Docker image and `railway.worker.json`. Give it the same database, Redis, JWT, token-hash, SMTP, Google Drive, and ML service variables as required by its jobs. Use `ML_SERVICE_AUTH_MODE=none` only with the private Railway ML service. Keep at least one worker replica running to consume queues; configure weekly and overdue scheduling per the existing worker design and avoid enabling duplicate schedulers.

## Build and deploy commands

For GitHub-based deployment, connect each Railway service to the repository/branch and deploy from the dashboard; later pushes to that branch trigger redeploys. Use these settings for new services:

- Frontend/backend/ML build: Dockerfile at the service root directory.
- Health check path: `/health` for each service.
- Restart policy: on failure, up to 10 retries.
- Worker start command: `npm run start:worker`; keep the worker private and always running.
- If building the API from the monorepo root instead of its Dockerfile, use `npm run railway:build:backend`. That command installs the backend lockfile with dev tools before Prisma generation and compilation.

To deploy the current checkout with the Railway CLI instead, authenticate once with `railway login`, then link each service and run `railway up` from its service directory:

```bash
cd frontend
railway link   # select project, environment, and frontend service
railway up

cd ../backend-api
railway link   # select the same project/environment and backend-api service
railway up

cd ../ml-service
railway link   # select the same project/environment and ml-service
railway up
```

For the optional worker, link a second service to the same repo and `/backend-api` root directory, set its config path to `/backend-api/railway.worker.json`, and deploy it. After deploying, generate public domains for only the frontend and API. Use the API public domain in `VITE_API_BASE_URL`, the frontend public URL in `FRONTEND_URL(S)`, and Railway's private reference above for `ML_SERVICE_URL`.

## Manual setup and verification

1. Add the GitHub repository and create each service with its root/config paths above.
2. Provision PostgreSQL and Redis; copy their credentials into Railway variables. The database schema/migrations are not applied by these deployment configs.
3. Add secrets and integration variables to the API and worker. Keep ML private and configure the API's private ML URL.
4. Deploy the API and ML service, generate their required networking settings, set cross-service variables, then deploy the frontend and worker.
5. Open the frontend, sign in, and verify login/refresh/logout cookies. The refresh cookie is scoped to `/auth`; separate Railway hosts require credentialed CORS and same-site origins. If using unrelated custom domains, browser cookie policy may require a same-origin proxy or a deliberate cookie policy change.
6. Verify API `/health`, ML `/health` from within the private network, authenticated ML-backed requests, and a queued email/job. Confirm the ML service has no public domain.

The Docker builds run the existing frontend TypeScript/Vite build, backend Prisma generation/TypeScript build, and ML Python dependency install. Resolve any existing build errors before expecting Railway deployments to become healthy.
