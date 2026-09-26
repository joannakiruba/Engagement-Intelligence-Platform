# Ticket 5 project context

Work in this repository only on ticket 5: self-service profile view/edit for all six roles. Owner: Ayesha Siddiqa.

Read IMPLEMENTATION.md before making changes. It is the acceptance plan. First inspect the checkout and current repository instructions, then update the plan with actual findings. Keep unchecked tasks unchecked until verified.

The reference main already implements GET/PATCH /users/me in backend-api/src/routes/users.routes.ts. Reuse and refine the existing routes, Prisma client, JWT and role-permission middleware. Preserve other users' CRUD and the merged schema. Treat the actual checkout as the source of truth when it differs from the reference plan.

Only name and phone are self-editable. Identity comes from the verified JWT subject. Reject forbidden fields, select safe response fields and test all six roles and cross-user isolation. Read and follow the detailed validation policy in IMPLEMENTATION.md.

Backend: Express/TypeScript, Prisma/PostgreSQL, Joi, Jest/Supertest. Frontend: React/TypeScript, React Router, Axios and Tailwind. Follow existing conventions. Integrate with existing authentication. Add only minimal missing frontend sign-in support if necessary for profile usage.

No tickets 15/21, reports, leaderboard, risk engine, email queue or unrelated redesign. Bedrock powers this coding session; no AWS SDK or credentials belong in application source.

Never print, read for model context, or commit .env secrets, AWS credential files, tokens, passwords, private keys, node_modules or generated build output. Refer to .env.example to learn variable names. Ask the developer to configure secret values locally.

Use disposable fixtures for database tests. Do not reset or migrate a shared/production database. Preserve uncommitted work. Report pre-existing build/migration problems separately and make only necessary, scoped compatibility fixes.

Keep IMPLEMENTATION.md updated with findings, changed files and real test results. Document the final API/UI usage in docs/TICKET_5_PROFILE.md. Do not claim verification that was not run. Prepare reviewable changes; do not commit, push, create a PR or deploy unless asked.
