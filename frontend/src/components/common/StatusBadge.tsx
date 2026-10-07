// src/components/common/StatusBadge.tsx
import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'attendance' | 'risk' | 'progress' | 'proof' | 'role' | 'default';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'default', className = '' }) => {
  const norm = (status || '').toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  // Attendance
  if (norm === 'PRESENT') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (norm === 'LATE') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (norm === 'ABSENT') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (norm === 'EXCUSED') {
    colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
  // Risk
  else if (norm === 'LOW') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (norm === 'MEDIUM') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (norm === 'HIGH') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  }
  // Progress & Proof
  else if (norm === 'COMPLETED' || norm === 'APPROVED' || norm === 'IMPROVED' || norm === 'ACTIVE') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (norm === 'IN_PROGRESS' || norm === 'PENDING' || norm === 'SEEN' || norm === 'ACTED') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (norm === 'REJECTED' || norm === 'DECLINED' || norm === 'DISMISSED' || norm === 'INACTIVE') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (norm === 'NOT_STARTED' || norm === 'NO_CHANGE' || norm === 'CANCELLED') {
    colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
  }
  // Role specific
  else if (norm === 'ADMIN') {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (norm === 'COORDINATOR') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (norm === 'MENTOR') {
    colorClasses = 'bg-teal-50 text-teal-700 border-teal-200';
  } else if (norm === 'FACULTY') {
    colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  } else if (norm === 'TRAINER') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (norm === 'STUDENT') {
    colorClasses = 'bg-sky-50 text-sky-700 border-sky-200';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {status}
    </span>
  );
};
