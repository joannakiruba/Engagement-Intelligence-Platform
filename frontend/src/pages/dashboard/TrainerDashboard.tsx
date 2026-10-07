// src/pages/dashboard/TrainerDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { LoadingState } from '../../components/common/LoadingState';
import { getBatches, getSessions } from '../../services/batches.service';
import { getAssessments } from '../../services/assessments.service';
import { getExcusedAttendance } from '../../services/attendance.service';
import { getFeedbackList } from '../../services/feedback.service';
import {
  Users,
  QrCode,
  CalendarCheck,
  Award,
  MessageSquare,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react';

export const TrainerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [excusedRecords, setExcusedRecords] = useState<any[]>([]);
  const [feedbackCount, setFeedbackCount] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [b, a, exc, fb] = await Promise.all([
          getBatches().catch(() => []),
          getAssessments().catch(() => []),
          getExcusedAttendance().catch(() => []),
          getFeedbackList().catch(() => []),
        ]);
        setBatches(b);
        setAssessments(a);
        setExcusedRecords(exc);
        setFeedbackCount(fb.length);
        const sessionResults = await Promise.all(
          b.map((batch: any) => getSessions(batch.id).catch(() => []))
        );
        setSessions(sessionResults.flat());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <LoadingState message="Loading trainer control center..." />;
  }

  const totalStudents = batches.reduce((acc, b) => acc + (b.memberCount || b.members?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2 backdrop-blur-xs">
            Trainer Operations
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Trainer Portal — {user?.name}</h1>
          <p className="text-amber-100 text-sm mt-1 max-w-xl">
            Live attendance tracking, dynamic QR projection with strict 8:05 AM cutoff,
            performance scoring, and student engagement feedback.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/attendance/overview"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-amber-800 font-semibold text-sm hover:bg-amber-50 shadow-sm transition-all"
          >
            <QrCode className="w-4 h-4" />
            Launch QR &amp; Sheets
          </Link>
          <Link
            to="/assessments/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-800/80 hover:bg-amber-900 text-white font-medium text-sm border border-amber-400/30 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            New Assessment
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Batches"
          value={batches.length}
          subtitle={`${totalStudents} active students enrolled`}
          icon={<Users className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          title="Assessments"
          value={assessments.length}
          subtitle="Quizzes, tests &amp; contests"
          icon={<Award className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Feedback Submitted"
          value={feedbackCount}
          subtitle="Session observations"
          icon={<MessageSquare className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Excused Leaves"
          value={excusedRecords.length}
          subtitle="Pending reason verification"
          icon={<CalendarCheck className="w-5 h-5" />}
          color="indigo"
        />
      </div>

      {/* Batches Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-slate-900 text-base">My Training Batches</h3>
              </div>
              <Link to="/batches" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                View all cohorts <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:shadow-xs transition-all bg-slate-50/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{batch.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{batch.department}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      {batch.memberCount || batch.members?.length || 0} students
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-3 line-clamp-2">
                    {batch.description || 'Full-stack software engineering specialization.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                    <Link
                      to={`/batches/${batch.id}`}
                      className="text-xs font-medium text-amber-700 hover:text-amber-800"
                    >
                      Batch Details
                    </Link>
                    <Link
                      to={`/attendance/report/${batch.id}`}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Report
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Assessments */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-slate-900 text-base">Assessments &amp; Scoring</h3>
              </div>
              <Link to="/assessments" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                Manage all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {assessments.slice(0, 4).map((a) => (
                <div key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{a.title}</h4>
                    <span className="text-xs text-slate-500">
                      Type: {a.type} • Max Score: {a.maxScore}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/assessments/${a.id}/scores`}
                      className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors"
                    >
                      Enter Scores
                    </Link>
                    <Link
                      to={`/assessments/${a.id}`}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QR Attendance & Trainer Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-slate-900 text-sm">QR Attendance</h3>
              </div>
              <Link to="/attendance/overview" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
                All Sessions
              </Link>
            </div>
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No sessions found for your batches.</p>
            ) : (
              <div className="space-y-2">
                {sessions.slice(0, 5).map((session: any) => (
                  <div key={session.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
                    <div className="min-w-0 flex-1 mr-2">
                      <span className="text-xs font-semibold text-slate-900 block truncate">{session.title}</span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(session.scheduledDate).toLocaleDateString()}
                      </span>
                    </div>
                    <a
                      href={`/attendance/qr-fullscreen/${session.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors inline-flex items-center gap-1"
                    >
                      <QrCode className="w-3 h-3" />
                      Project QR
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Trainer Shortcuts</h3>
            <div className="space-y-2">
              <Link
                to="/attendance/excused"
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-amber-600" />
                  <span>Review Excused Absences</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                to="/feedback/create"
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Submit Session Feedback</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                to="/leaderboard"
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span>Module 18 High-Achiever Leaderboard</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
