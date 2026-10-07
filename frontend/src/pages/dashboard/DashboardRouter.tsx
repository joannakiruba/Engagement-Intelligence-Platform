// src/pages/dashboard/DashboardRouter.tsx
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { StudentDashboard } from './StudentDashboard';
import { TrainerDashboard } from './TrainerDashboard';
import { FacultyDashboard } from './FacultyDashboard';
import { MentorDashboard } from './MentorDashboard';
import { CoordinatorDashboard } from './CoordinatorDashboard';
import { AdminDashboard } from './AdminDashboard';
import { LoadingState } from '../../components/common/LoadingState';

export const DashboardRouter: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Resolving role-authorized dashboard..." />;
  }

  if (!user) {
    return null;
  }

  switch (user.role) {
    case 'STUDENT':
      return <StudentDashboard />;
    case 'TRAINER':
      return <TrainerDashboard />;
    case 'FACULTY':
      return <FacultyDashboard />;
    case 'MENTOR':
      return <MentorDashboard />;
    case 'COORDINATOR':
      return <CoordinatorDashboard />;
    case 'ADMIN':
      return <AdminDashboard />;
    default:
      return <StudentDashboard />;
  }
};
