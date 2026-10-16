// src/pages/dashboard/DashboardRouter.tsx
import React, { lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/common/LoadingState';

// Lazy load dashboards to prevent unnecessary API calls for unauthorized roles
const StudentDashboard = lazy(() => import('./StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const TrainerDashboard = lazy(() => import('./TrainerDashboard').then(m => ({ default: m.TrainerDashboard })));
const FacultyDashboard = lazy(() => import('./FacultyDashboard').then(m => ({ default: m.FacultyDashboard })));
const MentorDashboard = lazy(() => import('./MentorDashboard').then(m => ({ default: m.MentorDashboard })));
const CoordinatorDashboard = lazy(() => import('./CoordinatorDashboard').then(m => ({ default: m.CoordinatorDashboard })));
const AdminDashboard = lazy(() => import('./AdminDashboard').then(m => ({ default: m.AdminDashboard })));

export const DashboardRouter: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Resolving role-authorized dashboard..." />;
  }

  if (!user) {
    return null;
  }

  let DashboardComponent;

  switch (user.role) {
    case 'STUDENT':
      DashboardComponent = StudentDashboard;
      break;
    case 'TRAINER':
      DashboardComponent = TrainerDashboard;
      break;
    case 'FACULTY':
      DashboardComponent = FacultyDashboard;
      break;
    case 'MENTOR':
      DashboardComponent = MentorDashboard;
      break;
    case 'COORDINATOR':
      DashboardComponent = CoordinatorDashboard;
      break;
    case 'ADMIN':
      DashboardComponent = AdminDashboard;
      break;
    default:
      DashboardComponent = StudentDashboard;
  }

  return (
    <Suspense fallback={<LoadingState message="Loading dashboard..." />}>
      <DashboardComponent />
    </Suspense>
  );
};
