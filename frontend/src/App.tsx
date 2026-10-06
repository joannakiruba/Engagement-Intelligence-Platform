import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/auth/LoginPage";
import ProfilePage from "./pages/profile/ProfilePage";
import AssessmentList from "./pages/assessments/AssessmentList";
import AssessmentCreate from "./pages/assessments/AssessmentCreate";
import AssessmentDetail from "./pages/assessments/AssessmentDetail";
import ScoreEntry from "./pages/assessments/ScoreEntry";
import BulkUpload from "./pages/assessments/BulkUpload";
import BatchList from "./pages/batches/BatchList";
import BatchCreate from "./pages/batches/BatchCreate";
import BatchDetail from "./pages/batches/BatchDetail";
import MarkAttendance from "./pages/attendance/MarkAttendance";
import SessionAttendance from "./pages/attendance/SessionAttendance";
import StudentAttendance from "./pages/attendance/StudentAttendance";
import QRFullscreen from "./pages/attendance/QRFullscreen";
import StudentCheckIn from "./pages/attendance/StudentCheckIn";
import AttendanceReport from "./pages/attendance/AttendanceReport";
import ExcusedReview from "./pages/attendance/ExcusedReview";
import FeedbackList from "./pages/feedback/FeedbackList";
import FeedbackForm from "./pages/feedback/FeedbackForm";
import FeedbackDetail from "./pages/feedback/FeedbackDetail";
import InterventionList from "./pages/interventions/InterventionList";
import InterventionDetail from "./pages/interventions/InterventionDetail";
import NotificationPanel from "./pages/interventions/NotificationPanel";
import {
  getEvents,
  getMyProofs,
  getAllProofs,
  submitProof,
  replaceProofFile,
  reviewProof,
  type EventItem,
  type ProofSubmission,
} from "./services/dashboard.service";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="p-4 text-gray-500">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function getNavLinks(role: string): { label: string; to: string }[] {
  const links: { label: string; to: string }[] = [];

  links.push({ label: "Assessments", to: "/assessments" });
  links.push({ label: "Batches", to: "/batches" });

  if (role === "STUDENT") {
    links.push({ label: "Check In", to: "/attendance/check-in" });
  } else if (["TRAINER", "ADMIN"].includes(role)) {
    links.push({ label: "Attendance", to: "/attendance/excused" });
  }

  if (role !== "COORDINATOR") {
    links.push({ label: "Feedback", to: "/feedback" });
  }

  if (["MENTOR", "STUDENT", "FACULTY", "ADMIN"].includes(role)) {
    links.push({ label: "Interventions", to: "/interventions" });
  }

  links.push({ label: "Proofs", to: "/proofs" });

  return links;
}

function AppNav() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link to="/" className="text-lg font-semibold text-gray-800">
          EIP
        </Link>
        {user &&
          getNavLinks(user.role).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-gray-600 hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        {user && (
          <>
            <Link to="/profile" className="text-gray-600 hover:text-gray-900">
              My Profile
            </Link>
            <div className="ml-auto flex items-center gap-4">
              <NotificationPanel />
            </div>
            <span className="text-sm text-gray-500">
              {user.name}{" "}
              <span className="text-xs text-gray-400">({user.role})</span>
            </span>
            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </>
        )}
        {!user && (
          <Link
            to="/login"
            className="ml-auto text-gray-600 hover:text-gray-900"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

function ProofsPage() {
  const { user } = useAuth();
  const isStudent = user?.role === "STUDENT";

  const [events, setEvents] = useState<EventItem[]>([]);
  const [proofs, setProofs] = useState<ProofSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Student: new submission state
  const [selectedEventId, setSelectedEventId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Student: replace file state
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  // Admin: filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEventId, setFilterEventId] = useState("");

  // Admin: review state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const evts = await getEvents();
      setEvents(evts);
      if (isStudent) {
        setProofs(await getMyProofs());
      } else {
        const filters: Record<string, string> = {};
        if (filterStatus) filters.status = filterStatus;
        if (filterEventId) filters.eventId = filterEventId;
        setProofs(await getAllProofs(filters));
      }
    } catch {
      setError("Failed to load data.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function getExistingProof(eventId: string): ProofSubmission | undefined {
    return proofs.find((p) => p.eventId === eventId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEventId || !fileInputRef.current?.files?.[0]) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await submitProof(selectedEventId, fileInputRef.current.files[0]);
      setSuccess("Proof submitted successfully.");
      setSelectedEventId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to submit proof.");
    }
    setSubmitting(false);
  }

  async function handleReplace(proofId: string) {
    const file = replaceFileRef.current?.files?.[0];
    if (!file) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await replaceProofFile(proofId, file);
      setSuccess("File replaced successfully. Status reset to PENDING.");
      setReplacingId(null);
      if (replaceFileRef.current) replaceFileRef.current.value = "";
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to replace file.");
    }
    setSubmitting(false);
  }

  async function handleReview(proofId: string, status: "APPROVED" | "REJECTED") {
    setReviewSaving(true);
    setError("");
    setSuccess("");
    try {
      await reviewProof(proofId, status, reviewRemarks || undefined);
      setSuccess(`Proof ${status.toLowerCase()} successfully.`);
      setReviewingId(null);
      setReviewRemarks("");
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to review proof.");
    }
    setReviewSaving(false);
  }

  async function handleAdminFilter(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterEventId) filters.eventId = filterEventId;
      setProofs(await getAllProofs(filters));
    } catch {
      setError("Failed to load proofs.");
    }
    setLoading(false);
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;

  // ---- Student View ----
  if (isStudent) {
    const eventsWithoutProof = events.filter((e) => !getExistingProof(e.id));
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          My Proof Submissions
        </h1>

        {error && <p className="text-red-600 mb-4">{error}</p>}
        {success && <p className="text-green-600 mb-4">{success}</p>}

        {/* Submit new proof */}
        {eventsWithoutProof.length > 0 && (
          <div className="bg-white border rounded p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Submit New Proof
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  required
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">Select an event...</option>
                  {eventsWithoutProof.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.eventType}) —{" "}
                      {new Date(ev.eventDate).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File (PNG, JPEG, GIF, or PDF — max 10 MB)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,application/pdf"
                  required
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Uploading..." : "Submit Proof"}
              </button>
            </form>
          </div>
        )}

        {/* Existing submissions */}
        {proofs.length === 0 ? (
          <p className="text-gray-500">No submissions yet.</p>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Your Submissions
            </h2>
            {proofs.map((proof) => (
              <div key={proof.id} className="bg-white border rounded p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {proof.event?.title ?? proof.eventId}
                    </p>
                    <p className="text-sm text-gray-500">
                      {proof.event?.eventType} —{" "}
                      {proof.event?.eventDate
                        ? new Date(proof.event.eventDate).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={proof.status} />
                </div>

                <div className="mt-3 flex items-center gap-4 text-sm">
                  <a
                    href={proof.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {proof.fileName}
                  </a>
                  <span className="text-gray-400">
                    Submitted {new Date(proof.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {proof.remarks && (
                  <div className="mt-2 bg-gray-50 border rounded px-3 py-2 text-sm">
                    <span className="text-gray-500">Reviewer remarks: </span>
                    <span className="text-gray-700">{proof.remarks}</span>
                  </div>
                )}

                {/* Replace file */}
                <div className="mt-3 border-t pt-3">
                  {replacingId === proof.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={replaceFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,application/pdf"
                        className="border rounded px-2 py-1 text-sm flex-1"
                      />
                      <button
                        onClick={() => handleReplace(proof.id)}
                        disabled={submitting}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submitting ? "Uploading..." : "Upload"}
                      </button>
                      <button
                        onClick={() => setReplacingId(null)}
                        className="text-sm text-gray-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReplacingId(proof.id)}
                      className="text-sm text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
                    >
                      Replace File
                    </button>
                  )}
                  {replacingId === proof.id && (
                    <p className="text-xs text-gray-400 mt-1">
                      Replacing your file resets the review status to PENDING.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- Admin / Trainer View ----
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Proof Submissions Review
      </h1>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {success && <p className="text-green-600 mb-4">{success}</p>}

      {/* Filters */}
      <form
        onSubmit={handleAdminFilter}
        className="flex flex-wrap gap-3 mb-4 items-end"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Event</label>
          <select
            value={filterEventId}
            onChange={(e) => setFilterEventId(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm w-60"
          >
            <option value="">All Events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
        >
          Apply
        </button>
      </form>

      {/* Table */}
      {proofs.length === 0 ? (
        <p className="text-gray-500">No proof submissions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                  Student
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                  Event
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                  File
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                  Submitted
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {proofs.map((proof) => (
                <tr key={proof.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">
                    <div className="font-medium">
                      {proof.student?.name ?? proof.studentId}
                    </div>
                    {proof.student?.email && (
                      <div className="text-xs text-gray-400">
                        {proof.student.email}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {proof.event?.title ?? proof.eventId}
                    {proof.event?.eventType && (
                      <span className="text-xs text-gray-400 ml-1">
                        ({proof.event.eventType})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <a
                      href={proof.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {proof.fileName}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {new Date(proof.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <StatusBadge status={proof.status} />
                    {proof.remarks && (
                      <p className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                        {proof.remarks}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {reviewingId === proof.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={reviewRemarks}
                          onChange={(e) => setReviewRemarks(e.target.value)}
                          placeholder="Remarks (optional)"
                          className="border rounded px-2 py-1 text-sm w-full"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleReview(proof.id, "APPROVED")}
                            disabled={reviewSaving}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(proof.id, "REJECTED")}
                            disabled={reviewSaving}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              setReviewingId(null);
                              setReviewRemarks("");
                            }}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReviewingId(proof.id)}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <AssessmentList />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />

          {/* Assessments */}
          <Route
            path="/assessments"
            element={
              <RequireAuth>
                <AssessmentList />
              </RequireAuth>
            }
          />
          <Route
            path="/assessments/create"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER", "ADMIN"]}>
                  <AssessmentCreate />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/assessments/:id/edit"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER", "ADMIN"]}>
                  <AssessmentCreate />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/assessments/:id"
            element={
              <RequireAuth>
                <AssessmentDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/assessments/:id/scores"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER", "ADMIN"]}>
                  <ScoreEntry />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/assessments/:id/bulk-upload"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER", "ADMIN"]}>
                  <BulkUpload />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Batches */}
          <Route
            path="/batches"
            element={
              <RequireAuth>
                <BatchList />
              </RequireAuth>
            }
          />
          <Route
            path="/batches/create"
            element={
              <RequireAuth>
                <RequireRole roles={["ADMIN"]}>
                  <BatchCreate />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/batches/:id/edit"
            element={
              <RequireAuth>
                <RequireRole roles={["ADMIN"]}>
                  <BatchCreate />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/batches/:id"
            element={
              <RequireAuth>
                <BatchDetail />
              </RequireAuth>
            }
          />

          {/* Attendance */}
          <Route
            path="/attendance/mark/:sessionId"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER"]}>
                  <MarkAttendance />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/attendance/session/:sessionId"
            element={
              <RequireAuth>
                <SessionAttendance />
              </RequireAuth>
            }
          />
          <Route
            path="/attendance/student/:studentId"
            element={
              <RequireAuth>
                <StudentAttendance />
              </RequireAuth>
            }
          />
          <Route
            path="/attendance/qr/:windowId"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER"]}>
                  <QRFullscreen />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/attendance/check-in"
            element={
              <RequireAuth>
                <RequireRole roles={["STUDENT"]}>
                  <StudentCheckIn />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/attendance/report/:batchId"
            element={
              <RequireAuth>
                <AttendanceReport />
              </RequireAuth>
            }
          />
          <Route
            path="/attendance/excused"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER", "ADMIN"]}>
                  <ExcusedReview />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Feedback */}
          <Route
            path="/feedback"
            element={
              <RequireAuth>
                <RequireRole
                  roles={[
                    "STUDENT",
                    "TRAINER",
                    "FACULTY",
                    "MENTOR",
                    "ADMIN",
                  ]}
                >
                  <FeedbackList />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/feedback/create/:sessionId"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER"]}>
                  <FeedbackForm />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/feedback/create"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER"]}>
                  <FeedbackForm />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/feedback/:id/edit"
            element={
              <RequireAuth>
                <RequireRole roles={["TRAINER"]}>
                  <FeedbackForm />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/feedback/:id"
            element={
              <RequireAuth>
                <RequireRole
                  roles={[
                    "STUDENT",
                    "TRAINER",
                    "FACULTY",
                    "MENTOR",
                    "ADMIN",
                  ]}
                >
                  <FeedbackDetail />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Interventions */}
          <Route
            path="/interventions"
            element={
              <RequireAuth>
                <RequireRole
                  roles={["MENTOR", "STUDENT", "FACULTY", "ADMIN"]}
                >
                  <InterventionList />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/interventions/:id"
            element={
              <RequireAuth>
                <RequireRole
                  roles={["MENTOR", "STUDENT", "FACULTY", "ADMIN"]}
                >
                  <InterventionDetail />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Proofs */}
          <Route
            path="/proofs"
            element={
              <RequireAuth>
                <ProofsPage />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
