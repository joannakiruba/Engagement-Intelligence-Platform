# Production deployment: Firebase Hosting and Cloud Run

This guide deploys the frontend to Firebase Hosting and the API, worker, and ML service to Cloud Run in `asia-south1`. The API is a Firebase Hosting rewrite target and is therefore publicly invokable at the Cloud Run layer; application routes still enforce their existing authentication and permissions. The ML and worker services remain private and use Cloud Run IAM.

Firebase Hosting forwards rewritten requests with their original paths and query strings. The browser continues to call relative paths such as `/auth/login`, so it stays on the Firebase Hosting origin while Hosting proxies the request to the API. The refresh cookie is host-only, `Secure` in production, `SameSite=Lax`, and scoped to `/auth`; login, refresh, and logout all use that same path. This is compatible with Hosting rewrites and avoids cross-site cookie behavior. See [Firebase Hosting with Cloud Run](https://firebase.google.com/docs/hosting/cloud-run) and [Hosting rewrite behavior](https://firebase.google.com/docs/hosting/full-config).

## 1. Set deployment variables

Run these Bash commands from the repository root. Replace each placeholder. The Hosting site ID is usually the Firebase project ID; set the custom domain only after it is connected to Hosting.

```bash
export PROJECT_ID="<gcp-and-firebase-project-id>"
export REGION="asia-south1"
export VPC_CONNECTOR="<serverless-vpc-access-connector-name>"
export REPOSITORY="eip"
export API_SERVICE="eip-api"
export WORKER_SERVICE="eip-worker"
export ML_SERVICE="eip-ml"
export API_SA="eip-api-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
export WORKER_SA="eip-worker-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
export ML_SA="eip-ml-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
export SCHEDULER_SA="eip-cloud-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"
export FIREBASE_ORIGIN="https://${PROJECT_ID}.web.app"
export FIREBASE_COMPAT_ORIGIN="https://${PROJECT_ID}.firebaseapp.com"
export CUSTOM_ORIGIN="$FIREBASE_ORIGIN" # replace after a custom domain is connected
export IMAGE_TAG="$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com
gcloud artifacts repositories create "$REPOSITORY" --repository-format=docker --location="$REGION"
```

Create the four service accounts and provision Secret Manager entries before deployment:

```bash
gcloud iam service-accounts create eip-api-runtime --display-name="EIP API runtime"
gcloud iam service-accounts create eip-worker-runtime --display-name="EIP worker runtime"
gcloud iam service-accounts create eip-ml-runtime --display-name="EIP ML runtime"
gcloud iam service-accounts create eip-cloud-scheduler --display-name="EIP Cloud Scheduler"
```

Create these secrets with the actual values in Secret Manager: `eip-database-url`, `eip-jwt-secret`, `eip-token-hash-secret`, `eip-redis-url`, `eip-smtp-user`, `eip-smtp-password`, `eip-google-drive-client-email`, `eip-google-drive-private-key`, and `eip-google-drive-folder-id`. Grant `roles/secretmanager.secretAccessor` on each required secret to its runtime identity. The API needs all listed secrets; the worker needs database, JWT, token hash, Redis, and SMTP secrets; the ML service needs the database secret.

For example, after creating each named secret, grant access as follows (repeat the binding for each secret in that service's list above):

```bash
for SECRET in eip-database-url eip-jwt-secret eip-token-hash-secret eip-redis-url eip-smtp-user eip-smtp-password eip-google-drive-client-email eip-google-drive-private-key eip-google-drive-folder-id; do
  gcloud secrets add-iam-policy-binding "$SECRET" --member="serviceAccount:${API_SA}" --role="roles/secretmanager.secretAccessor"
done
for SECRET in eip-database-url eip-jwt-secret eip-token-hash-secret eip-redis-url eip-smtp-user eip-smtp-password; do
  gcloud secrets add-iam-policy-binding "$SECRET" --member="serviceAccount:${WORKER_SA}" --role="roles/secretmanager.secretAccessor"
done
gcloud secrets add-iam-policy-binding eip-database-url --member="serviceAccount:${ML_SA}" --role="roles/secretmanager.secretAccessor"
```

If Redis is Memorystore, create a Serverless VPC Access connector and put its name in `VPC_CONNECTOR`. Use a private address and configure `eip-redis-url` for that endpoint. For TLS-enabled Redis, use `rediss://`; otherwise keep Redis reachable only through the private VPC path.

## 2. Build and deploy the ML service privately

```bash
export ML_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/eip-ml:${IMAGE_TAG}"
gcloud builds submit ml-service --tag "$ML_IMAGE"

gcloud run deploy "$ML_SERVICE" \
  --image "$ML_IMAGE" \
  --region "$REGION" \
  --service-account "$ML_SA" \
  --no-allow-unauthenticated \
  --max 3 \
  --set-secrets="DATABASE_URL=eip-database-url:latest" \
  --set-env-vars="DB_POOL_MIN_SIZE=1,DB_POOL_MAX_SIZE=5"

export ML_URL="$(gcloud run services describe "$ML_SERVICE" --region "$REGION" --format='value(status.url)')"

gcloud run services add-iam-policy-binding "$ML_SERVICE" \
  --region "$REGION" \
  --member="serviceAccount:${API_SA}" \
  --role="roles/run.invoker"
gcloud run services add-iam-policy-binding "$ML_SERVICE" \
  --region "$REGION" \
  --member="serviceAccount:${WORKER_SA}" \
  --role="roles/run.invoker"
```

Cloud Run must use the canonical `status.url` as the ID-token audience. The API and worker fetch Google-signed ID tokens from Cloud Run's metadata server and send them as bearer tokens. Do not set a custom ML audience unless you configure that custom audience on the receiving service. See [Cloud Run service-to-service authentication](https://cloud.google.com/run/docs/authenticating/service-to-service).

## 3. Build and deploy the API

```bash
export API_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/eip-api:${IMAGE_TAG}"
gcloud builds submit backend-api --tag "$API_IMAGE"

gcloud run deploy "$API_SERVICE" \
  --image "$API_IMAGE" \
  --region "$REGION" \
  --service-account "$API_SA" \
  --allow-unauthenticated \
  --max 5 \
  --vpc-connector "$VPC_CONNECTOR" \
  --vpc-egress private-ranges-only \
  --set-env-vars="NODE_ENV=production,FRONTEND_URL=${CUSTOM_ORIGIN},FRONTEND_URLS=${FIREBASE_ORIGIN};${FIREBASE_COMPAT_ORIGIN};${CUSTOM_ORIGIN},ML_SERVICE_URL=${ML_URL},ML_SERVICE_AUDIENCE=${ML_URL}" \
  --set-secrets="DATABASE_URL=eip-database-url:latest,JWT_SECRET=eip-jwt-secret:latest,TOKEN_HASH_SECRET=eip-token-hash-secret:latest,REDIS_URL=eip-redis-url:latest,SMTP_USER=eip-smtp-user:latest,SMTP_PASS=eip-smtp-password:latest,GOOGLE_DRIVE_CLIENT_EMAIL=eip-google-drive-client-email:latest,GOOGLE_DRIVE_PRIVATE_KEY=eip-google-drive-private-key:latest,GOOGLE_DRIVE_FOLDER_ID=eip-google-drive-folder-id:latest"
```

The API is public at the Cloud Run edge because Firebase Hosting rewrites invoke the service without a Cloud Run identity token. Keep the ML and worker services private. The API's existing JWT and permission checks remain the access control for protected operations. Firebase's Cloud Run Hosting guide demonstrates allowing unauthenticated invocation for a rewrite target: [Firebase Hosting with Cloud Run](https://firebase.google.com/docs/hosting/cloud-run).

When a custom domain is connected, set `CUSTOM_ORIGIN` to its exact HTTPS origin before deploying. The env list uses semicolons so gcloud's comma-separated flag parser does not split the value.

## 4. Deploy the worker privately

The worker uses the same image with a separate process command. Start with one instance so scheduled job consumption and Redis/database connection counts stay bounded.

```bash
gcloud run deploy "$WORKER_SERVICE" \
  --image "$API_IMAGE" \
  --region "$REGION" \
  --service-account "$WORKER_SA" \
  --command npm \
  --args run,start:worker \
  --no-allow-unauthenticated \
  --min 1 \
  --max 1 \
  --no-cpu-throttling \
  --vpc-connector "$VPC_CONNECTOR" \
  --vpc-egress private-ranges-only \
  --set-env-vars="NODE_ENV=production,FRONTEND_URL=${CUSTOM_ORIGIN},FRONTEND_URLS=${FIREBASE_ORIGIN};${FIREBASE_COMPAT_ORIGIN};${CUSTOM_ORIGIN},ML_SERVICE_URL=${ML_URL},ML_SERVICE_AUDIENCE=${ML_URL},WEEKLY_REPORT_ENABLED=true,WEEKLY_REPORT_TZ=Asia/Kolkata" \
  --set-secrets="DATABASE_URL=eip-database-url:latest,JWT_SECRET=eip-jwt-secret:latest,TOKEN_HASH_SECRET=eip-token-hash-secret:latest,REDIS_URL=eip-redis-url:latest,SMTP_USER=eip-smtp-user:latest,SMTP_PASS=eip-smtp-password:latest"

export WORKER_URL="$(gcloud run services describe "$WORKER_SERVICE" --region "$REGION" --format='value(status.url)')"
gcloud run services add-iam-policy-binding "$WORKER_SERVICE" \
  --region "$REGION" \
  --member="serviceAccount:${SCHEDULER_SA}" \
  --role="roles/run.invoker"
```

Keep the worker service private. Its scheduler routes are intended to be protected by Cloud Run IAM, not called by browsers.

## 5. Create recurring Cloud Scheduler jobs

```bash
gcloud scheduler jobs create http eip-weekly-reports \
  --location "$REGION" \
  --schedule="0 9 * * 1" \
  --time-zone="Asia/Kolkata" \
  --uri="${WORKER_URL}/internal/scheduler/weekly-reports" \
  --http-method=POST \
  --oidc-service-account-email="$SCHEDULER_SA" \
  --oidc-token-audience="$WORKER_URL"

gcloud scheduler jobs create http eip-overdue-check \
  --location "$REGION" \
  --schedule="0 * * * *" \
  --time-zone="Etc/UTC" \
  --uri="${WORKER_URL}/internal/scheduler/overdue-check" \
  --http-method=POST \
  --oidc-service-account-email="$SCHEDULER_SA" \
  --oidc-token-audience="$WORKER_URL"

gcloud scheduler jobs create http eip-mentor-alert-recovery \
  --location "$REGION" \
  --schedule="*/15 * * * *" \
  --time-zone="Etc/UTC" \
  --uri="${WORKER_URL}/internal/scheduler/mentor-alert-recovery" \
  --http-method=POST \
  --oidc-service-account-email="$SCHEDULER_SA" \
  --oidc-token-audience="$WORKER_URL"
```

The weekly trigger queues one report per mentor and uses the original scheduler time to select the completed reporting week. The overdue endpoint uses the scheduled hour in its stable BullMQ job ID so Cloud Scheduler retries do not enqueue duplicate scans for that hour. The mentor-alert recovery endpoint periodically requeues the latest score snapshots in each batch; the ML service's unique risk-snapshot index makes replay safe and recovers from a transient Redis outage during score creation.

## 6. Build and deploy Firebase Hosting

```bash
npm ci --prefix frontend
npm run build --prefix frontend
firebase deploy --only hosting --project "$PROJECT_ID"
```

The repo's `firebase.json` rewrites `/api`, `/auth`, `/users`, `/admin/users`, and `/health` to `eip-api`. Keep the API base URL empty in the production frontend so requests stay same-origin and use those rewrites.

## 7. Verify the live deployment

1. Open the Firebase site and sign in. In browser developer tools, confirm the login response sets an `HttpOnly; Secure; SameSite=Lax` `refresh_token` cookie with `Path=/auth` on the Firebase/custom host.
2. Refresh the page or call an authenticated API route. Confirm `/auth/refresh` sends the cookie and rotates it, and logout clears it with the same path and attributes.
3. Confirm direct requests to the ML `run.app` URL without an ID token receive `401` or `403`; confirm an ML-backed API operation succeeds through the API.
4. Confirm the API's CORS response permits the exact Firebase/custom origins and does not return `Access-Control-Allow-Origin` for an unlisted origin.
5. Check Cloud Run logs for metadata token errors, ML `401/403`, Redis failures, database pool exhaustion, and worker restarts. Confirm all Scheduler jobs report successful executions.

## Manual setup still required

- Firebase project ID/site and custom domain, if used.
- Cloud project APIs, Artifact Registry, runtime identities, and secret values/permissions.
- Supabase TLS connection string and migration state. This guide does not run or create database migrations.
- Memorystore instance, VPC connector, Redis URL, and an agreed Redis TLS mode.
- `eip-api`, `eip-worker`, and `eip-ml` Cloud Run IAM/service settings and invoker bindings.
- Cloud Scheduler jobs and service account binding.
- SMTP and Google Drive credentials and their Secret Manager entries.
- A trained `ml-service/models/risk_model.joblib` artifact. The repo currently contains no model file, so the ML prediction route reports `NOT_READY` until one is supplied.
- End-to-end browser verification of the refresh cookie through the deployed Hosting rewrite.
