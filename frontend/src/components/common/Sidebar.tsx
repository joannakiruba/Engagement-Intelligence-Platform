// src/components/common/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { RoleName } from '../../types';
import {
  LayoutDashboard,
  BarChart3,
  Trophy,
  Users,
  CalendarCheck,
  QrCode,
  Award,
  MessageSquare,
  AlertTriangle,
  LifeBuoy,
  Bell,
  CheckSquare,
  Calendar,
  FileCheck2,
  UserCheck,
  ShieldAlert,
  UserCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItemDef {
  label: string;
  to: string;
  icon: React.ReactNode;
  requiredPermission?: string;
  requiredAny?: string[];
  allowedRoles?: RoleName[];
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose, isCollapsed = false, onToggleCollapse }) => {
  const { hasPermission, hasAnyPermission, user } = useAuth();

  const navGroups: { group: string; items: NavItemDef[] }[] = [
    {
      group: 'Intelligence & Insights',
      items: [
        {
          label: 'Dashboard',
          to: '/',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          label: 'Engagement Analytics',
          to: '/engagement',
          icon: <BarChart3 className="w-4 h-4" />,
          requiredAny: ['batches:read:any', 'attendance:export', 'sessions:read:any'],
        },
        {
          label: 'Weekly Leaderboard',
          to: '/leaderboard',
          icon: <Trophy className="w-4 h-4" />,
          badge: 'Mod 18',
        },
      ],
    },
    {
      group: 'Academic Tracking',
      items: [
        {
          label: 'Batches & Sessions',
          to: '/batches',
          icon: <Users className="w-4 h-4" />,
          allowedRoles: ['TRAINER', 'FACULTY', 'MENTOR', 'COORDINATOR', 'ADMIN'],
          requiredAny: ['batches:read:own', 'batches:read:any', 'batches:read:assigned'],
        },
        {
          label: user?.role === 'STUDENT' ? 'My Attendance' : user?.role === 'MENTOR' ? 'Assigned Session QR' : 'Attendance Control',
          to: user?.role === 'STUDENT' ? '/attendance/my' : user?.role === 'MENTOR' ? '/attendance/assigned' : '/attendance/overview',
          icon: user?.role === 'MENTOR' ? <QrCode className="w-4 h-4" /> : <CalendarCheck className="w-4 h-4" />,
          requiredAny: ['attendance:mark:self', 'attendance:mark:batch', 'attendance:read:any', 'attendance:read:batch', 'attendance:read:assigned'],
        },
        {
          label: 'Assessments',
          to: '/assessments',
          icon: <Award className="w-4 h-4" />,
          requiredAny: ['assessments:read:own', 'assessments:read:batch', 'assessments:read:assigned', 'assessments:read:any'],
        },
        {
          label: 'Trainer Feedback',
          to: '/feedback',
          icon: <MessageSquare className="w-4 h-4" />,
          requiredAny: ['feedback:read:own_received', 'feedback:read:own_given', 'feedback:read:any', 'feedback:read:assigned'],
        },
      ],
    },
    {
      group: 'Intervention Engine',
      items: [
        {
          label: 'Risk Intelligence',
          to: '/risk',
          icon: <AlertTriangle className="w-4 h-4" />,
          requiredAny: ['risk_scores:read:assigned', 'risk_scores:read:any', 'risk_scores:calculate:batch'],
        },
        {
          label: 'Mentor Alerts',
          to: '/mentor-alerts',
          icon: <Bell className="w-4 h-4" />,
          requiredAny: ['interventions:create:assigned', 'risk_scores:read:assigned', 'risk_scores:read:any'],
        },
        {
          label: 'Interventions',
          to: '/interventions',
          icon: <LifeBuoy className="w-4 h-4" />,
          requiredAny: ['interventions:read:own', 'interventions:read:assigned', 'interventions:read:any'],
        },
      ],
    },
    {
      group: 'Activity & Placement',
      items: [
        {
          label: user?.role === 'STUDENT' ? 'My Tasks' : 'Task Assignments',
          to: '/tasks',
          icon: <CheckSquare className="w-4 h-4" />,
          requiredAny: ['tasks:read:own', 'tasks:read:batch', 'tasks:read:any'],
        },
        {
          label: 'Events & Hackathons',
          to: '/events',
          icon: <Calendar className="w-4 h-4" />,
          requiredAny: ['events:read:own', 'events:read:batch', 'events:read:any'],
        },
        {
          label: user?.role === 'STUDENT' ? 'My Proofs' : 'Proof Verification',
          to: '/proofs',
          icon: <FileCheck2 className="w-4 h-4" />,
          requiredAny: ['proofs:submit:self', 'proofs:read:batch', 'proofs:read:any', 'proofs:approve:any'],
        },
      ],
    },
    {
      group: 'Administration',
      items: [
        {
          label: 'Mentor Pairings',
          to: '/mentor-assignments',
          icon: <UserCheck className="w-4 h-4" />,
          requiredAny: ['mentor_assignments:create', 'mentor_assignments:read:any'],
        },
        {
          label: 'User Directory',
          to: '/admin/users',
          icon: <ShieldAlert className="w-4 h-4" />,
          requiredAny: ['users:create', 'users:change_role', 'users:activate'],
        },
        {
          label: 'My Profile',
          to: '/profile',
          icon: <UserCircle className="w-4 h-4" />,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col transition-all duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-16 w-64' : 'w-64'}`}
      >
        {/* Mobile Header / Brand */}
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          {isCollapsed ? (
            <div className="flex items-center justify-center w-full lg:block hidden">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                H
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                H
              </div>
              <div>
                <span className="font-bold text-sm text-white tracking-tight">HOPE Intelligence</span>
                <p className="text-[10px] text-slate-400">Engagement &amp; Intervention</p>
              </div>
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group, gIdx) => {
            // Filter items based on user permissions
            const visibleItems = group.items.filter((item) => {
              if (item.allowedRoles && !item.allowedRoles.includes(user?.role as RoleName)) {
                return false;
              }
              if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
                return false;
              }
              if (item.requiredAny && !hasAnyPermission(...item.requiredAny)) {
                return false;
              }
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-3 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {group.group}
                  </div>
                )}
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    end={item.to === '/'}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2 rounded-lg text-xs font-medium transition-colors relative group ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <div className={`flex items-center ${isCollapsed ? '' : 'gap-2.5'} truncate`}>
                      {item.icon}
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {item.badge}
                      </span>
                    )}
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="hidden lg:group-hover:block absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
                        {item.label}
                        {item.badge && <span className="ml-2 text-indigo-300">({item.badge})</span>}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </div>

        {/* Collapse Toggle Button (Desktop only) */}
        {onToggleCollapse && (
          <div className="hidden lg:block p-3 border-t border-slate-800">
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span className="ml-2 text-xs font-medium">Collapse</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* User Persona footer */}
        {user && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/40">
            {isCollapsed ? (
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="px-2 py-1.5 rounded-lg bg-slate-800/40 flex items-center justify-between">
                <div className="truncate">
                  <div className="text-xs font-medium text-slate-200 truncate">{user.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{user.role}</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Active Session" />
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
