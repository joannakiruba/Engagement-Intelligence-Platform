// src/pages/dashboard/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { LoadingState } from '../../components/common/LoadingState';
import { getEngagementDashboard } from '../../services/engagement.service';
import { getUsers } from '../../services/users.service';
import { getBatches } from '../../services/batches.service';
import { getMentorAssignments } from '../../services/mentor.service';
import {
  ShieldAlert,
  Users,
  Layers,
  Calendar,
  UserCheck,
  Award,
  BarChart3,
  Trophy,
  ArrowRight,
  PlusCircle,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [eng, uList, bList, mAssign] = await Promise.all([
          getEngagementDashboard().catch(() => null),
          getUsers().catch(() => []),
          getBatches().catch(() => []),
          getMentorAssignments().catch(() => []),
        ]);
        setEngagement(eng);
        setUsersList(uList);
        setBatches(bList);
        setAssignments(mAssign);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <LoadingState message="Loading platform administration console..." />;
  }

  const trainersCount = usersList.filter((u) => u.role === 'TRAINER').length;
  const mentorsCount = usersList.filter((u) => u.role === 'MENTOR').length;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2 backdrop-blur-xs">
            System Administration
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Admin Console — {user?.name}</h1>
          <p className="text-purple-100 text-sm mt-1 max-w-xl">
            Complete institutional control over RBAC permissions, batch rosters, mentor
            assignments, academic sessions, and platform-wide engagement intelligence.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-purple-900 font-semibold text-sm hover:bg-purple-50 shadow-sm transition-all"
          >
            <Users className="w-4 h-4" />
            Manage Users
          </Link>
          <Link
            to="/batches/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700/80 hover:bg-purple-700 text-white font-medium text-sm border border-purple-400/30 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            New Batch
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={usersList.length}
          subtitle={`${trainersCount} Trainers • ${mentorsCount} Mentors`}
          icon={<Users className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Active Batches"
          value={batches.length}
          subtitle="Cross-departmental tracks"
          icon={<Layers className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Mentor Pairings"
          value={assignments.length}
          subtitle="Assigned mentorships"
          icon={<UserCheck className="w-5 h-5" />}
          color="indigo"
        />
        <StatCard
          title="Institutional Attendance"
          value={`${engagement?.attendanceRate || 85}%`}
          subtitle="Strict 8:05 AM window"
          icon={<Calendar className="w-5 h-5" />}
          color="emerald"
        />
      </div>

      {/* Admin Modules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Link
          to="/admin/users"
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-700 w-fit mb-3 group-hover:bg-purple-100 transition-colors">
            <Users className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-slate-900 text-base">User Directory &amp; RBAC</h4>
          <p className="text-xs text-slate-500 mt-1">
            Provision users, assign roles (Admin, Faculty, Mentor, Trainer, Coordinator, Student), and manage account statuses.
          </p>
          <span className="mt-4 text-xs font-semibold text-purple-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            Manage users <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/mentor-assignments"
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-700 w-fit mb-3 group-hover:bg-teal-100 transition-colors">
            <UserCheck className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-slate-900 text-base">Mentor Assignments</h4>
          <p className="text-xs text-slate-500 mt-1">
            Pair faculty mentors to specific students and balance mentorship caseloads across departments.
          </p>
          <span className="mt-4 text-xs font-semibold text-teal-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            Configure pairings <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/engagement"
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700 w-fit mb-3 group-hover:bg-blue-100 transition-colors">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-slate-900 text-base">Engagement Intelligence</h4>
          <p className="text-xs text-slate-500 mt-1">
            Institutional overview, cross-batch comparisons, session trends, and multi-signal disengagement detection.
          </p>
          <span className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            View analytics <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/leaderboard"
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700 w-fit mb-3 group-hover:bg-amber-100 transition-colors">
            <Trophy className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-slate-900 text-base">Weekly Leaderboard (Mod 18)</h4>
          <p className="text-xs text-slate-500 mt-1">
            Calculate and publish top-10 weekly high achievers based on attendance (30%), assessment (50%), and contest (20%).
          </p>
          <span className="mt-4 text-xs font-semibold text-amber-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            Open leaderboard <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/batches"
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700 w-fit mb-3 group-hover:bg-indigo-100 transition-colors">
            <Layers className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-slate-900 text-base">Batches &amp; Cohort Rosters</h4>
          <p className="text-xs text-slate-500 mt-1">
            Create new training cohorts, assign trainers, enroll students, and schedule session tracks.
          </p>
          <span className="mt-4 text-xs font-semibold text-indigo-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            Manage batches <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/risk"
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-rose-300 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 w-fit mb-3 group-hover:bg-rose-100 transition-colors">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h4 className="font-semibold text-slate-900 text-base">Risk Categorization Engine</h4>
          <p className="text-xs text-slate-500 mt-1">
            Trigger rule-based (+20/+25/+15) and ML hybrid risk score evaluations across any student or batch.
          </p>
          <span className="mt-4 text-xs font-semibold text-rose-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            Review risk engine <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
};
