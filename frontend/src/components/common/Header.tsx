// src/components/common/Header.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from './StatusBadge';
import { RoleName } from '../../types';
import {
  Menu,
  User as UserIcon,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const ROLES_LIST: { role: RoleName; label: string; desc: string }[] = [
  { role: 'STUDENT', label: 'Student', desc: 'Attendance check-in, marks, proofs & tasks' },
  { role: 'TRAINER', label: 'Trainer', desc: 'Attendance QR/sheet, assessments & feedback' },
  { role: 'FACULTY', label: 'Faculty', desc: 'Academic oversight, all batches & results' },
  { role: 'MENTOR', label: 'Mentor', desc: 'High-risk alerts, weakness analysis & interventions' },
  { role: 'COORDINATOR', label: 'Coordinator', desc: 'Placement readiness, hackathons & proof approvals' },
  { role: 'ADMIN', label: 'Administrator', desc: 'System management, users, roles & system config' },
];

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout, switchPersona } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900">HOPE</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase tracking-wider">
                  Intelligence
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium hidden sm:block">
                Student Engagement &amp; Intervention Platform
              </p>
            </div>
          </Link>
        </div>

        {user && (
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Persona Fast-Switcher (Essential for testing all 6 role-based flows) */}
            <div className="relative">
              <button
                onClick={() => {
                  setRoleSwitcherOpen(!roleSwitcherOpen);
                  setDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
                title="Switch active persona to test permissions"
              >
                <span className="text-slate-400 hidden md:inline">Role:</span>
                <span className="font-semibold text-indigo-700">{user.role}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleSwitcherOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setRoleSwitcherOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1">
                      <p className="text-xs font-semibold text-slate-900">Switch Persona (Demo)</p>
                      <p className="text-[11px] text-slate-500">
                        Experience role- &amp; permission-governed interfaces
                      </p>
                    </div>
                    <div className="space-y-1">
                      {ROLES_LIST.map((item) => {
                        const isCurrent = user.role === item.role;
                        return (
                          <button
                            key={item.role}
                            onClick={() => {
                              switchPersona(item.role);
                              setRoleSwitcherOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-start justify-between transition-colors ${
                              isCurrent
                                ? 'bg-indigo-50/80 text-indigo-900'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div>
                              <span className="font-semibold">{item.label}</span>
                              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                {item.desc}
                              </p>
                            </div>
                            {isCurrent && <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setDropdownOpen(!dropdownOpen);
                  setRoleSwitcherOpen(false);
                }}
                className="flex items-center gap-2 p-1 pl-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-500">{user.email}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1.5">
                        <StatusBadge status={user.role} type="role" />
                      </div>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-50 mt-1"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      My Profile
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
