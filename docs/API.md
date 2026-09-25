# API Documentation

## Interactive Docs (Swagger UI)

Start the backend server and visit:

```
http://localhost:3000/api-docs
```

Swagger UI provides an interactive explorer for all API endpoints with request/response schemas, authentication flows, and the ability to try endpoints directly from the browser.

## Authentication

Most endpoints require a JWT Bearer token. Obtain one via `POST /auth/login`, then pass it in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens expire per the `JWT_ACCESS_EXPIRY` config. Use `POST /auth/refresh` (reads the httpOnly cookie) to rotate.

## API Endpoint Summary

### Auth (`/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout (revoke tokens) |
| POST | `/auth/activate` | Activate account with token |
| POST | `/auth/resend-activation` | Resend activation email |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |
| POST | `/auth/change-password` | Change password (authenticated) |

### Users (`/users`, `/admin/users`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me` | Own profile |
| PATCH | `/users/me` | Update own profile |
| GET | `/users` | List users (scoped by RBAC) |
| GET | `/users/:id` | Get user by ID (scoped) |
| PATCH | `/users/:id` | Admin update user |
| PATCH | `/users/:id/role` | Change user role |
| PATCH | `/users/:id/status` | Activate/deactivate user |
| PATCH | `/users/:id/recover` | Admin account recovery |
| POST | `/admin/users/bulk-csv` | Bulk create users from CSV |

### Batches (`/api/batches`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/batches` | List batches |
| POST | `/api/batches` | Create batch |
| GET | `/api/batches/:id` | Get batch |
| PUT | `/api/batches/:id` | Update batch |
| DELETE | `/api/batches/:id` | Delete batch |
| GET | `/api/batches/:id/roster` | Get student roster |
| POST | `/api/batches/:id/students` | Add student |
| DELETE | `/api/batches/:id/students/:studentId` | Remove student |
| GET | `/api/batches/:id/trainers` | List trainers |
| POST | `/api/batches/:id/trainers` | Assign trainer |
| DELETE | `/api/batches/:id/trainers/:trainerId` | Remove trainer |
| GET | `/api/batches/:id/sessions` | List sessions |
| POST | `/api/batches/:id/sessions` | Create session |

### Sessions (`/api/sessions`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions/:id` | Get session |
| PUT | `/api/sessions/:id` | Update session |
| DELETE | `/api/sessions/:id` | Delete session |

### Assessments (`/api/assessments`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/assessments` | List assessments |
| POST | `/api/assessments` | Create assessment (with sections/questions) |
| GET | `/api/assessments/:id` | Get assessment |
| PUT | `/api/assessments/:id` | Update assessment metadata |
| DELETE | `/api/assessments/:id` | Delete assessment |
| POST | `/api/assessments/:id/sections` | Add section |
| PUT | `/api/assessments/:id/sections/:sectionId` | Update section |
| DELETE | `/api/assessments/:id/sections/:sectionId` | Delete section |
| POST | `/api/assessments/:id/sections/:sectionId/questions` | Add question |
| PUT | `/api/assessments/:id/questions/:questionId` | Update question |
| DELETE | `/api/assessments/:id/questions/:questionId` | Delete question |
| POST | `/api/assessments/:id/scores` | Submit scores for student |
| POST | `/api/assessments/:id/scores/bulk` | Bulk CSV score upload |
| GET | `/api/assessments/:id/results` | Get all results |
| GET | `/api/assessments/:id/results/:studentId` | Get student result |

### Attendance (`/api/attendance`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/attendance` | List records (filter by sessionId, studentId) |
| POST | `/api/attendance` | Mark single attendance |
| POST | `/api/attendance/bulk` | Bulk mark for session |
| GET | `/api/attendance/:id` | Get record |
| PUT | `/api/attendance/:id` | Update record |
| DELETE | `/api/attendance/:id` | Delete record |

### Feedback (`/api/feedback`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/feedback` | List records (filter by sessionId, studentId, trainerId) |
| POST | `/api/feedback` | Create feedback |
| GET | `/api/feedback/:id` | Get record |
| PUT | `/api/feedback/:id` | Update record |
| DELETE | `/api/feedback/:id` | Delete record |

### Mentor Assignments (`/api/mentor-assignments`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mentor-assignments` | List assignments (filter by mentorId, studentId) |
| POST | `/api/mentor-assignments` | Create assignment |
| GET | `/api/mentor-assignments/:id` | Get assignment |
| DELETE | `/api/mentor-assignments/:id` | Delete assignment |

## Seed Data

Run the seed script to populate the database with test data:

```bash
cd backend-api
SEED_TEST_PASSWORD="your-dev-password-12chars" npm run seed
```

This creates:
- 6 roles with 67 permissions and role-permission mappings
- 6 test users (one per role: admin, coordinator, mentor, faculty, trainer, student)
- 4 additional trainers and 3 additional mentors
- 50 students across 4 batches
- 10 training sessions
- 200 attendance records
- 8 assessments with sections, questions, and ~100 scored results
- 50 trainer feedback entries
- Mentor-student assignments (all 50 students distributed across 4 mentors)

All test users share the password set via `SEED_TEST_PASSWORD`. Login emails follow the pattern `role@hope.dev` (e.g., `admin@hope.dev`).

## Response Envelope

All endpoints return a consistent JSON envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Human-readable error message" }
```

## OpenAPI Spec

The raw OpenAPI 3.0 JSON spec is at `backend-api/src/swagger/swagger.json`.
