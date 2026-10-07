// src/pages/dashboard/FacultyDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { LoadingState } from '../../components/common/LoadingState';
import { getEngagementDashboard } from '../../services/engagement.service';
import { getBatches } from '../../services/batches.service';
import {
  GraduationCap,
  Users,
  Award,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  FileSpreadsheet,
} from 'lucide-react';

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [dash, bList] = await Promise.all([
          getEngagementDashboard().catch(() => null),
          getBatches().catch(() => []),
        ]);
        setOverview(dash);
        setBatches(bList);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <LoadingState message="Aggregating academic cohort metrics..." />;
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2 backdrop-blur-xs">
            Faculty Academic Oversight
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Faculty Portal — {user?.name}</h1>
          <p className="text-indigo-100 text-sm mt-1 max-w-xl">
            Departmental student progress, assessment trends across cohorts, and early intervention
            visibility for academic excellence.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/engagement"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm hover:bg-indigo-50 shadow-sm transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            Engagement Analytics
          </Link>
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-800/80 hover:bg-indigo-800 text-white font-medium text-sm border border-indigo-400/30 transition-all"
          >
            Weekly Leaderboard
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students Tracked"
          value={overview?.totalStudents ?? 'N/A'}
          subtitle="Enrolled across 4 cohorts"
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Platform Attendance"
          value={`${overview?.attendanceRate ?? 0}%`}
          subtitle="Strict 8:05 AM session rate"
          icon={<GraduationCap className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Average Assessment"
          value={`${overview?.avgAssessmentScore ?? 0}%`}
          subtitle="Quizzes &amp; coding tests"
          icon={<Award className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Students Needing Support"
          value={overview?.highRiskCount ?? 0}
          subtitle="Flagged by multi-signal engine"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="rose"
        />
      </div>

      {/* Cohorts Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-base">Department Cohorts &amp; Batches</h3>
            <p className="text-xs text-slate-500">Academic performance and session milestones by track</p>
          </div>
          <Link to="/batches" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            Browse all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {batches.map((b) => (
            <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:shadow-xs transition-all">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {b.department}
              </span>
              <h4 className="font-semibold text-slate-900 text-sm mt-2">{b.name}</h4>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{b.description}</p>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  {b.memberCount || b.members?.length || 0} Students
                </span>
                <Link to={`/attendance/report/${b.id}`} className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Report
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
