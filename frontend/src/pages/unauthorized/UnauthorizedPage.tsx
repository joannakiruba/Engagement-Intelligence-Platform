// src/pages/unauthorized/UnauthorizedPage.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldX, ArrowLeft, Home, UserCheck } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const state = location.state as { attemptedPermission?: string; attemptedPermissions?: string[] } | null;

  const attempted = state?.attemptedPermission || state?.attemptedPermissions?.join(', ') || 'Restricted feature';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
          <ShieldX className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
            HTTP 403 Forbidden
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-2">Access Permission Denied</h1>
          <p className="text-xs text-slate-500 mt-1">
            Your current account role (<strong className="text-slate-800">{user?.role}</strong>) does not hold the
            authorized permission required for this resource.
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Required Permission Boundary:</span>
          <code className="text-indigo-600 font-mono text-[11px] block">{attempted}</code>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Link
            to="/"
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Home className="w-3.5 h-3.5" /> Return to Dashboard
          </Link>


        </div>
      </div>
    </div>
  );
};
