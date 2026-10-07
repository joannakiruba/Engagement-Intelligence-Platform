// src/components/common/PermissionGuard.tsx
import React, { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

interface PermissionGuardProps {
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  anyPermissions,
  allPermissions,
  fallback = null,
  children,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  let isAllowed = true;

  if (permission && !hasPermission(permission)) {
    isAllowed = false;
  }

  if (anyPermissions && anyPermissions.length > 0 && !hasAnyPermission(...anyPermissions)) {
    isAllowed = false;
  }

  if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(...allPermissions)) {
    isAllowed = false;
  }

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
