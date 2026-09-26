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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="p-4 text-gray-500">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function AppNav() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link to="/" className="text-lg font-semibold text-gray-800">
          EIP
        </Link>
        <Link to="/assessments" className="text-gray-600 hover:text-gray-900">
          Assessments
        </Link>
        <Link to="/batches" className="text-gray-600 hover:text-gray-900">
          Batches
        </Link>
        {user && (
          <>
            <Link to="/profile" className="text-gray-600 hover:text-gray-900">
              My Profile
            </Link>
            <span className="ml-auto text-sm text-gray-500">{user.name}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </>
        )}
        {!user && (
          <Link to="/login" className="ml-auto text-gray-600 hover:text-gray-900">
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
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route path="/" element={<AssessmentList />} />
          <Route path="/assessments" element={<AssessmentList />} />
          <Route path="/assessments/create" element={<AssessmentCreate />} />
          <Route path="/assessments/:id/edit" element={<AssessmentCreate />} />
          <Route path="/assessments/:id" element={<AssessmentDetail />} />
          <Route path="/assessments/:id/scores" element={<ScoreEntry />} />
          <Route path="/assessments/:id/bulk-upload" element={<BulkUpload />} />
          <Route path="/batches" element={<BatchList />} />
          <Route path="/batches/create" element={<BatchCreate />} />
          <Route path="/batches/:id/edit" element={<BatchCreate />} />
          <Route path="/batches/:id" element={<BatchDetail />} />
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
