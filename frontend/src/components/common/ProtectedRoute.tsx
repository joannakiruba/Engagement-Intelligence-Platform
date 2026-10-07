// src/components/common/ProtectedRoute.tsx
import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from './LoadingState';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredAnyPermissions?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredAnyPermissions,
}) => {
  const { user, loading, hasPermission, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingState message="Authenticating session..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" state={{ attemptedPermission: requiredPermission }} replace />;
  }

  if (requiredAnyPermissions && !hasAnyPermission(...requiredAnyPermissions)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{ attemptedPermissions: requiredAnyPermissions }}
        replace
      />
    );
  }

  return <>{children}</>;
};
