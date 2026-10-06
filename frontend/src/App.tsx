import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';

// Auth & access
import { LoginPage } from './pages/auth/LoginPage';
import ActivateAccountPage from './pages/auth/ActivateAccountPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import { UnauthorizedPage } from './pages/unauthorized/UnauthorizedPage';

// Dashboards
import { DashboardRouter } from './pages/dashboard/DashboardRouter';
import { EngagementDashboard } from './pages/engagement/EngagementDashboard';
import { LeaderboardPage } from './pages/leaderboard/LeaderboardPage';

// Batches
import { BatchList } from './pages/batches/BatchList';
import { BatchCreate } from './pages/batches/BatchCreate';
import { BatchDetail } from './pages/batches/BatchDetail';

// Attendance
import { StudentAttendance } from './pages/attendance/StudentAttendance';
import { MarkAttendance } from './pages/attendance/MarkAttendance';
import StudentCheckIn from './pages/attendance/StudentCheckIn';
import { SessionAttendance } from './pages/attendance/SessionAttendance';
import { AttendanceReport } from './pages/attendance/AttendanceReport';
import { ExcusedReview } from './pages/attendance/ExcusedReview';
import { QRFullscreen } from './pages/attendance/QRFullscreen';
import FlagReview from './pages/attendance/FlagReview';

// Assessments
import { AssessmentList } from './pages/assessments/AssessmentList';
import { AssessmentCreate } from './pages/assessments/AssessmentCreate';
import { AssessmentDetail } from './pages/assessments/AssessmentDetail';
import { ScoreEntry } from './pages/assessments/ScoreEntry';
import { BulkUpload } from './pages/assessments/BulkUpload';

// Feedback
import { FeedbackList } from './pages/feedback/FeedbackList';
import { FeedbackForm } from './pages/feedback/FeedbackForm';
import { FeedbackDetail } from './pages/feedback/FeedbackDetail';

// Risk & Interventions
import { RiskOverviewPage } from './pages/risk/RiskOverviewPage';
import { MentorAlertsPage } from './pages/mentor/MentorAlertsPage';
import { InterventionListPage } from './pages/interventions/InterventionListPage';
import { InterventionCreatePage } from './pages/interventions/InterventionCreatePage';
import { InterventionDetailPage } from './pages/interventions/InterventionDetailPage';

// Tasks, Events, Proofs
import { TaskListPage } from './pages/tasks/TaskListPage';
import { TaskDetailPage } from './pages/tasks/TaskDetailPage';
import { EventsPage } from './pages/events/EventsPage';
import { ProofsPage } from './pages/proofs/ProofsPage';

// Notifications & Registrations
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { MyRegistrationsPage } from './pages/registrations/MyRegistrationsPage';

// Admin & Mentor
import { MentorAssignmentsPage } from './pages/mentor/MentorAssignmentsPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import UserList from './pages/admin/UserList';
import UserCreate from './pages/admin/UserCreate';
import UserDetail from './pages/admin/UserDetail';
import UserBulkUpload from './pages/admin/UserBulkUpload';
import { ProfilePage } from './pages/profile/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate" element={<ActivateAccountPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Fullscreen standalone tools */}
          <Route
            path="/attendance/qr-fullscreen/:sessionId"
            element={
              <ProtectedRoute requiredAnyPermissions={['attendance:mark:batch', 'sessions:read:any']}>
                <QRFullscreen />
              </ProtectedRoute>
            }
          />

          {/* Main app with shared navigation layout */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard (role-aware) */}
            <Route index element={<DashboardRouter />} />

            {/* Engagement Analytics */}
            <Route
              path="/engagement"
              element={
                <ProtectedRoute requiredAnyPermissions={['batches:read:any', 'attendance:export', 'sessions:read:any']}>
                  <EngagementDashboard />
                </ProtectedRoute>
              }
            />

            {/* Leaderboard */}
            <Route path="/leaderboard" element={<LeaderboardPage />} />

            {/* Batches */}
            <Route
              path="/batches"
              element={
                <ProtectedRoute requiredAnyPermissions={['batches:read:own', 'batches:read:any', 'batches:read:assigned']}>
                  <BatchList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/batches/new"
              element={
                <ProtectedRoute requiredPermission="batches:create">
                  <BatchCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/batches/create"
              element={
                <ProtectedRoute requiredPermission="batches:create">
                  <BatchCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/batches/:id"
              element={
                <ProtectedRoute requiredAnyPermissions={['batches:read:own', 'batches:read:any', 'batches:read:assigned']}>
                  <BatchDetail />
                </ProtectedRoute>
              }
            />

            {/* Attendance */}
            <Route
              path="/attendance/my"
              element={
                <ProtectedRoute requiredPermission="attendance:read:own">
                  <StudentAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/check-in"
              element={
                <ProtectedRoute requiredPermission="attendance:mark:self">
                  <StudentCheckIn />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/overview"
              element={
                <ProtectedRoute requiredAnyPermissions={['attendance:read:batch', 'attendance:read:any']}>
                  <SessionAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/session/:sessionId"
              element={
                <ProtectedRoute requiredAnyPermissions={['attendance:read:batch', 'attendance:read:any']}>
                  <SessionAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/mark/:sessionId"
              element={
                <ProtectedRoute requiredPermission="attendance:mark:batch">
                  <MarkAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/report/:batchId"
              element={
                <ProtectedRoute requiredPermission="attendance:export">
                  <AttendanceReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/student/:studentId"
              element={
                <ProtectedRoute requiredAnyPermissions={['attendance:read:own', 'attendance:read:batch', 'attendance:read:any']}>
                  <StudentAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/excused"
              element={
                <ProtectedRoute requiredAnyPermissions={['attendance:update:batch', 'attendance:update:any']}>
                  <ExcusedReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/qr/:windowId"
              element={
                <ProtectedRoute requiredPermission="attendance:mark:batch">
                  <QRFullscreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance/flags"
              element={
                <ProtectedRoute requiredAnyPermissions={['attendance:read:any', 'attendance:update:any']}>
                  <FlagReview />
                </ProtectedRoute>
              }
            />

            {/* Assessments */}
            <Route
              path="/assessments"
              element={
                <ProtectedRoute requiredAnyPermissions={['assessments:read:own', 'assessments:read:batch', 'assessments:read:any']}>
                  <AssessmentList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assessments/new"
              element={
                <ProtectedRoute requiredPermission="assessments:create:batch">
                  <AssessmentCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assessments/create"
              element={
                <ProtectedRoute requiredPermission="assessments:create:batch">
                  <AssessmentCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assessments/:id"
              element={
                <ProtectedRoute requiredAnyPermissions={['assessments:read:own', 'assessments:read:batch', 'assessments:read:any']}>
                  <AssessmentDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assessments/:id/edit"
              element={
                <ProtectedRoute requiredAnyPermissions={['assessments:update:batch', 'assessments:update:any']}>
                  <AssessmentCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assessments/:id/scores"
              element={
                <ProtectedRoute requiredPermission="assessments:create:batch">
                  <ScoreEntry />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assessments/:id/bulk-upload"
              element={
                <ProtectedRoute requiredPermission="assessments:create:batch">
                  <BulkUpload />
                </ProtectedRoute>
              }
            />

            {/* Feedback */}
            <Route
              path="/feedback"
              element={
                <ProtectedRoute requiredAnyPermissions={['feedback:read:own_received', 'feedback:read:own_given', 'feedback:read:any', 'feedback:read:assigned']}>
                  <FeedbackList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feedback/new"
              element={
                <ProtectedRoute requiredPermission="feedback:create:batch">
                  <FeedbackForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feedback/create"
              element={
                <ProtectedRoute requiredPermission="feedback:create:batch">
                  <FeedbackForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feedback/create/:sessionId"
              element={
                <ProtectedRoute requiredPermission="feedback:create:batch">
                  <FeedbackForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feedback/:id"
              element={
                <ProtectedRoute requiredAnyPermissions={['feedback:read:own_received', 'feedback:read:own_given', 'feedback:read:any', 'feedback:read:assigned']}>
                  <FeedbackDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feedback/:id/edit"
              element={
                <ProtectedRoute requiredPermission="feedback:create:batch">
                  <FeedbackForm />
                </ProtectedRoute>
              }
            />

            {/* Risk Management */}
            <Route
              path="/risk"
              element={
                <ProtectedRoute requiredAnyPermissions={['risk_scores:read:assigned', 'risk_scores:read:any', 'risk_scores:calculate:batch']}>
                  <RiskOverviewPage />
                </ProtectedRoute>
              }
            />

            {/* Mentor Alerts */}
            <Route
              path="/mentor-alerts"
              element={
                <ProtectedRoute requiredAnyPermissions={['interventions:create:assigned', 'risk_scores:read:assigned', 'risk_scores:read:any']}>
                  <MentorAlertsPage />
                </ProtectedRoute>
              }
            />

            {/* Interventions */}
            <Route
              path="/interventions"
              element={
                <ProtectedRoute requiredAnyPermissions={['interventions:read:own', 'interventions:read:assigned', 'interventions:read:any']}>
                  <InterventionListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interventions/new"
              element={
                <ProtectedRoute requiredAnyPermissions={['interventions:create:assigned']}>
                  <InterventionCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interventions/:id"
              element={
                <ProtectedRoute requiredAnyPermissions={['interventions:read:own', 'interventions:read:assigned', 'interventions:read:any']}>
                  <InterventionDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Tasks */}
            <Route
              path="/tasks"
              element={
                <ProtectedRoute requiredAnyPermissions={['tasks:read:own', 'tasks:read:batch', 'tasks:read:any']}>
                  <TaskListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks/:id"
              element={
                <ProtectedRoute requiredAnyPermissions={['tasks:read:own', 'tasks:read:batch', 'tasks:read:any']}>
                  <TaskDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Events */}
            <Route
              path="/events"
              element={
                <ProtectedRoute requiredPermission="events:read:any">
                  <EventsPage />
                </ProtectedRoute>
              }
            />

            {/* Proofs */}
            <Route
              path="/proofs"
              element={
                <ProtectedRoute requiredAnyPermissions={['proofs:submit:self', 'proofs:read:batch', 'proofs:read:any', 'proofs:approve:any']}>
                  <ProofsPage />
                </ProtectedRoute>
              }
            />

            {/* Notifications */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute requiredAnyPermissions={['notifications:read:own']}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />

            {/* My Registrations (Student) */}
            <Route
              path="/my-registrations"
              element={
                <ProtectedRoute requiredAnyPermissions={['event_registrations:create:self', 'event_registrations:read:own']}>
                  <MyRegistrationsPage />
                </ProtectedRoute>
              }
            />

            {/* Mentor Assignments */}
            <Route
              path="/mentor-assignments"
              element={
                <ProtectedRoute requiredAnyPermissions={['mentor_assignments:create', 'mentor_assignments:read:any']}>
                  <MentorAssignmentsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin — User Management */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredAnyPermissions={['users:create', 'users:read:any', 'users:change_role']}>
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/list"
              element={
                <ProtectedRoute requiredAnyPermissions={['users:create', 'users:read:any']}>
                  <UserList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/create"
              element={
                <ProtectedRoute requiredPermission="users:create">
                  <UserCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/bulk-upload"
              element={
                <ProtectedRoute requiredPermission="users:create">
                  <UserBulkUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/:id"
              element={
                <ProtectedRoute requiredAnyPermissions={['users:read:any', 'users:update:any']}>
                  <UserDetail />
                </ProtectedRoute>
              }
            />

            {/* Profile */}
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
