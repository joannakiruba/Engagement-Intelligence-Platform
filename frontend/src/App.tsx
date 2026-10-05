import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
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
            <span className="ml-auto text-sm text-gray-500">
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
