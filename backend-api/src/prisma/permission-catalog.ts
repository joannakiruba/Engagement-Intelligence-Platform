// prisma/permission-catalog.ts
//
// Single source of truth for every Permission code and which of the 6
// roles holds it. Consumed by prisma/seed.ts to idempotently upsert
// Role, Permission, and RolePermission rows.
//
// SCOPE CONVENTION
// -----------------
// Scope (own / batch / assigned / any) is encoded directly in the code
// string rather than as a separate RolePermission column — the existing
// schema has no scope field, so this avoids a migration. This table only
// decides WHICH permission codes a role holds; resolving what "own" /
// "batch" / "assigned" concretely means for a given request (which row
// IDs a query is allowed to touch) is the RBAC middleware / query layer's
// job, not this table's.
//
//   :own       -> records authored by, or otherwise belonging to, the
//                 requester — the requester is not necessarily the record's
//                 subject (e.g. a Mentor's own-created intervention about
//                 a different person)
//   :self      -> the action's TARGET is the requester's own identity
//                 (e.g. marking your own attendance, updating your own
//                 profile) — distinct from :own, which can be about someone
//                 else's record that you authored
//   :batch     -> records belonging to the requester's own batch/session
//   :assigned  -> records belonging to a Mentor's assigned students
//                 (resolved via MentorAssignment)
//   :any       -> unrestricted

export const ROLES = [
  'STUDENT',
  'TRAINER',
  'FACULTY',
  'MENTOR',
  'COORDINATOR',
  'ADMIN',
] as const;

export type RoleName = (typeof ROLES)[number];

export interface PermissionDef {
  code: string;
  description: string;
}

export const PERMISSIONS: PermissionDef[] = [
  // ---- Users & Account Lifecycle ----
  { code: 'users:create', description: 'Create users (bulk CSV or manual)' },
  { code: 'users:read:own', description: "Read one's own user record" },
  { code: 'users:read:assigned', description: "Read user records of one's assigned students" },
  { code: 'users:read:any', description: 'Read any user record' },
  { code: 'users:update:self', description: "Update one's own profile" },
  { code: 'users:update:any', description: 'Update any user record' },
  { code: 'users:change_role', description: "Change another user's role" },
  { code: 'users:activate', description: 'Manually activate/deactivate an account' },
  { code: 'users:recover_account', description: 'Trigger account-recovery token flow for another user' },

  // ---- Batches & Sessions ----
  { code: 'batches:create', description: 'Create batches' },
  { code: 'batches:update:any', description: 'Update any batch' },
  { code: 'batches:read:own', description: "Read one's own batch" },
  { code: 'batches:read:assigned', description: "Read batches of one's assigned students" },
  { code: 'batches:read:any', description: 'Read any batch' },
  { code: 'sessions:create:batch', description: 'Create sessions for own batch' },
  { code: 'sessions:update:batch', description: 'Update/reschedule sessions for own batch' },
  { code: 'sessions:read:own', description: "Read sessions of one's own batch" },
  { code: 'sessions:read:assigned', description: "Read sessions of one's assigned students' batch" },
  { code: 'sessions:read:any', description: 'Read any session' },

  // ---- Attendance ----
  { code: 'attendance:mark:self', description: 'Mark own attendance (student check-in, 8:05 cutoff)' },
  { code: 'attendance:mark:batch', description: "Mark attendance for one's own session/batch" },
  { code: 'attendance:read:own', description: "Read one's own attendance" },
  { code: 'attendance:read:batch', description: "Read attendance for one's own batch" },
  { code: 'attendance:read:assigned', description: "Read attendance for one's assigned students" },
  { code: 'attendance:read:any', description: 'Read any attendance record' },
  { code: 'attendance:update:batch', description: 'Correct attendance for own batch (always audit-logged)' },
  { code: 'attendance:update:any', description: 'Correct any attendance record (always audit-logged)' },
  { code: 'attendance:export', description: 'Export attendance reports' },

  // ---- Assessments ----
  { code: 'assessments:create:batch', description: 'Create/enter assessment scores for own batch (incl. bulk CSV)' },
  { code: 'assessments:read:own', description: "Read one's own assessment results" },
  { code: 'assessments:read:batch', description: "Read assessment results for one's own batch" },
  { code: 'assessments:read:assigned', description: "Read assessment results for one's assigned students" },
  { code: 'assessments:read:any', description: 'Read any assessment result' },
  { code: 'assessments:update:batch', description: 'Update assessment results for own batch' },
  { code: 'assessments:update:any', description: 'Update any assessment result' },

  // ---- Trainer Feedback ----
  { code: 'feedback:create:batch', description: "Give feedback for one's own session's students" },
  { code: 'feedback:read:own_received', description: 'Read feedback received about oneself' },
  { code: 'feedback:read:own_given', description: 'Read feedback one has given' },
  { code: 'feedback:read:assigned', description: "Read feedback for one's assigned students" },
  { code: 'feedback:read:any', description: 'Read any feedback' },

  // ---- Mentor Assignments ----
  { code: 'mentor_assignments:create', description: 'Assign a mentor to a student' },
  {
    code: 'mentor_assignments:read:own',
    description: "Read one's own mentor/mentee assignment",
    // RESOLVED (was flagged for inconsistent granularity vs. feedback:read's
    // own_given/own_received split): kept as one code. Unlike feedback,
    // where Trainer and Student need genuinely different permission grants,
    // here the two directions (Student's own mentor / Mentor's own
    // mentees) are already fully separated by which role holds the code —
    // a split would add two code strings for zero additional access-control
    // benefit.
  },
  { code: 'mentor_assignments:read:any', description: 'Read any mentor assignment' },

  // ---- Risk Scores ----
  { code: 'risk_scores:read:own', description: "Read one's own risk score" },
  {
    code: 'risk_scores:read:category:batch',
    description:
      'Read risk CATEGORY only (Low/Medium/High) for own batch — deliberately excludes score breakdown and factors JSON',
  },
  { code: 'risk_scores:read:assigned', description: "Read full risk score (incl. factors) for one's assigned students" },
  { code: 'risk_scores:read:any', description: 'Read full risk score for any student' },
  { code: 'risk_scores:calculate:batch', description: 'Trigger risk calculation for students in own batch' },
  { code: 'risk_scores:calculate:any', description: 'Trigger risk calculation for any student/batch' },

  // ---- Interventions ----
  { code: 'interventions:create:assigned', description: "Create an intervention for one's assigned students" },
  { code: 'interventions:update:own', description: 'Update/progress an intervention one created' },
  { code: 'interventions:log_outcome:own', description: 'Log outcome on an intervention one created' },
  { code: 'interventions:read:own', description: 'Read interventions assigned to oneself (read-only)' },
  { code: 'interventions:read:assigned', description: "Read interventions for one's assigned students" },
  { code: 'interventions:read:any', description: 'Read any intervention' },

  // ---- Notifications ----
  { code: 'notifications:read:own', description: "Read one's own notifications" },

  // ---- Events & Proofs ----
  { code: 'events:create', description: 'Create events' },
  { code: 'events:update:any', description: 'Update any event' },
  { code: 'events:read:any', description: 'Browse events (all roles)' },
  { code: 'event_registrations:create:self', description: 'Register oneself for an event' },
  { code: 'event_registrations:read:own', description: "Read one's own event registrations" },
  { code: 'event_registrations:read:any', description: 'Read any event registration' },
  { code: 'proofs:submit:self', description: 'Submit proof/certification for oneself' },
  { code: 'proofs:read:own', description: "Read one's own proof submissions" },
  { code: 'proofs:read:batch', description: "Read proof submissions for one's own batch" },
  { code: 'proofs:read:any', description: 'Read any proof submission' },
  { code: 'proofs:approve:batch', description: "Approve/reject proofs for one's own batch" },
  { code: 'proofs:approve:any', description: 'Approve/reject any proof submission' },

  // ---- Audit Log ----
  { code: 'audit_logs:read', description: 'Read the audit log' },
];

export const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  STUDENT: [
    'users:read:own',
    'users:update:self',
    'batches:read:own',
    'sessions:read:own',
    'attendance:mark:self',
    'attendance:read:own',
    'assessments:read:own',
    'feedback:read:own_received',
    'mentor_assignments:read:own',
    'risk_scores:read:own',
    'interventions:read:own',
    'notifications:read:own',
    'events:read:any',
    'event_registrations:create:self',
    'event_registrations:read:own',
    'proofs:submit:self',
    'proofs:read:own',
  ],

  TRAINER: [
    'users:read:own',
    'users:update:self',
    'batches:read:own',
    'sessions:create:batch',
    'sessions:update:batch',
    'sessions:read:own',
    'attendance:mark:batch',
    'attendance:read:batch',
    'attendance:update:batch',
    'attendance:export',
    'assessments:create:batch',
    'assessments:read:batch',
    'assessments:update:batch',
    'feedback:create:batch',
    'feedback:read:own_given',
    // Category-only, not full risk_scores:read:batch (which doesn't exist
    // as a code): a full score/factors breakdown is partly derived from
    // OTHER trainers' feedback risk contributions, which this trainer has
    // no independent permission to read — exposing the synthesized score
    // would leak that signal sideways. It also keeps risk-triage as a
    // single owned pipeline (Mentor), avoiding two people independently
    // acting on the same flagged student.
    'risk_scores:read:category:batch',
    'risk_scores:calculate:batch',
    'notifications:read:own',
    'events:read:any',
    'proofs:read:batch',
    'proofs:approve:batch',
  ],

  FACULTY: [
    'users:read:own',
    'users:update:self',
    'users:read:any',
    'batches:read:any',
    'sessions:read:any',
    'attendance:read:any',
    'attendance:export',
    'assessments:read:any',
    'feedback:read:any',
    'mentor_assignments:read:any',
    'risk_scores:read:any',
    'interventions:read:any',
    'notifications:read:own',
    'events:read:any',
  ],

  MENTOR: [
    'users:read:own',
    'users:update:self',
    'users:read:assigned',
    'batches:read:assigned',
    'sessions:read:assigned',
    'attendance:read:assigned',
    'assessments:read:assigned',
    'feedback:read:assigned',
    'mentor_assignments:read:own',
    'risk_scores:read:assigned',
    'interventions:create:assigned',
    'interventions:update:own',
    'interventions:log_outcome:own',
    'interventions:read:assigned',
    'notifications:read:own',
    'events:read:any',
    // Deliberately no proofs:* or event_registrations:* — not an input to
    // the risk engine today (README Module 12 rules: attendance /
    // assessments / feedback only). Revisit only if event/hackathon
    // disengagement becomes a modeled risk factor.
  ],

  COORDINATOR: [
    'users:read:own',
    'users:update:self',
    // Added: Coordinator approves proofs and reviews event registrations
    // for students across batches/departments they don't personally know —
    // needs to identify who a record belongs to. Read-only directory
    // access, same tier Faculty already holds.
    'users:read:any',
    'batches:read:any',
    'sessions:read:any',
    'attendance:read:any',
    'attendance:export',
    'assessments:read:any',
    'risk_scores:read:any', // placement-readiness tracking
    'notifications:read:own',
    'events:create',
    'events:update:any',
    'events:read:any',
    'event_registrations:read:any',
    'proofs:read:any',
    'proofs:approve:any',
  ],

  ADMIN: [
    // Every :any permission (read AND update), plus the account-lifecycle
    // permissions unique to this role and mentor_assignments:create.
    // Deliberately does NOT hold: session/assessment/feedback creation
    // (stays Trainer-owned — Admin can correct via assessments:update:any
    // and attendance:update:any, but doesn't do routine data entry) or
    // intervention create/update/log_outcome (stays Mentor-owned — Admin
    // gets interventions:read:any for oversight, not operation).
    'users:create',
    'users:read:own',
    'users:update:self',
    'users:read:any',
    'users:update:any',
    'users:change_role',
    'users:activate',
    'users:recover_account',
    'batches:create',
    'batches:update:any',
    'batches:read:any',
    'sessions:read:any',
    'attendance:read:any',
    'attendance:update:any',
    'attendance:export',
    'assessments:read:any',
    'assessments:update:any',
    'feedback:read:any',
    'mentor_assignments:create',
    'mentor_assignments:read:any',
    'risk_scores:read:any',
    'risk_scores:calculate:any',
    'interventions:read:any',
    'notifications:read:own',
    'events:create',
    'events:update:any',
    'events:read:any',
    'event_registrations:read:any',
    'proofs:read:any',
    'proofs:approve:any',
    'audit_logs:read',
  ],
};
