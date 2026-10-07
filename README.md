# HOPE — merged backend and frontend

This project combines Joanna Kiruba's backend main branch with Meenakshi's React frontend. The active frontend calls the real Express API; the frontend repository's demo server and automatic demo login are not used.

**Start here:** [MERGE_SETUP.md](MERGE_SETUP.md). See [verification and limitations](docs/MERGE_VERIFICATION.md) before deployment.

## Project layout

- backend-api/: Express + TypeScript, JWT/RBAC, Prisma/PostgreSQL, BullMQ/Redis, Nodemailer and all upstream API modules.
- frontend/: React + TypeScript + Vite + Tailwind, Axios integration and role-based screens.
- ml-service/: upstream Python/FastAPI service; requires its own setup/model/database tables.
- database/, infra/, scripts/, docs/: upstream assets plus merge instructions.
- reference/backend-original-frontend/: original backend repository's frontend retained as reference, excluded from the active build. The new UI is not a feature-for-feature replacement for every original screen; see the verification document.

## Commands (after environment and database setup)

```bash
npm run install:all
npm run build
npm start
```

Open http://localhost:3000. The backend serves the built frontend and API on one origin. For development, run npm run dev:api and npm run dev:web in separate terminals, then open http://localhost:5173.

No GitHub repositories were pushed to or remotely merged. This is a source integration deliverable, not a production deployment.
