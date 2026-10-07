# Railway frontend service

The frontend image serves the Vite build with Nginx. Nginx listens on the
runtime `PORT` environment variable (defaulting to `8080` in the image), and
the Docker image exposes port `8080`.

## Railway settings

- Set the service root directory to `/frontend` and use its `Dockerfile`.
- Ensure the service's `PORT` variable is `8080`.
- Set the public domain's target port to `8080`. It must match the port Nginx
  listens on; a target port of `80` causes Railway's edge proxy to return 502.
- Set the health check path to `/health`. Nginx returns HTTP 200 at this path.
- Set `VITE_API_BASE_URL` to the backend's public HTTPS URL before building.

For an existing domain, update its target port in Railway under the frontend
service's Settings > Networking > Public Networking. Alternatively, with the
Railway CLI linked to the project and environment, run:

```sh
railway domain update <frontend-domain> --port 8080
```

The repository's `railway.json` also declares `/health`; configure the same
health check in the Railway service settings when the service is managed via
the dashboard.
