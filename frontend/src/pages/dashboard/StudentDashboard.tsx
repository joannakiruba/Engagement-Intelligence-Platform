// src/pages/dashboard/StudentDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { getStudentAttendance } from '../../services/attendance.service';
import { getAssessments, getStudentAssessmentResult } from '../../services/assessments.service';
import { getMyTasks } from '../../services/tasks.service';
import { getMyProofs } from '../../services/proofs.service';
import { getStudentRisk } from '../../services/risk.service';
import { getEvents } from '../../services/events.service';
import {
  CalendarCheck,
  Award,
  CheckSquare,
  Trophy,
  QrCode,
  ArrowRight,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [recentAssessments, setRecentAssessments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  const [riskData, setRiskData] = useState<any>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        setLoading(true);
        const [att, tasksRes, proofsRes, risk, events] = await Promise.all([
          getStudentAttendance(user.id).catch(() => null),
          getMyTasks().catch(() => []),
          getMyProofs().catch(() => []),
          getStudentRisk(user.id).catch(() => null),
          getEvents().catch(() => []),
        ]);

        setAttendanceData(att);
        setTasks(tasksRes);
        setProofs(proofsRes);
        setRiskData(risk);
        setUpcomingEvents(events.slice(0, 3));

        // Load assessment results
        const allAssessments = await getAssessments().catch(() => []);
        if (allAssessments.length > 0) {
          const resultsPromises = allAssessments.slice(0, 4).map(async (a: any) => {
            const myRes = await getStudentAssessmentResult(a.id, user.id).catch(() => null);
            return {
              assessment: a,
              result: myRes,
            };
          });
          const resolved = await Promise.all(resultsPromises);
          setRecentAssessments(resolved);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return <LoadingState message="Loading your student engagement dashboard..." />;
  }

  const attendanceRate = attendanceData?.summary?.attendanceRate ?? 0;
  const completedTasks = tasks.filter((t) => t.submission?.progress === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2 backdrop-blur-xs">
            Student Portal
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user?.name}!</h1>
          <p className="text-indigo-100 text-sm mt-1 max-w-xl">
            Track your daily attendance with strict 8:05 AM verification, assessment scores,
            placement milestones, and weekly high-achiever leaderboard ranking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/attendance/check-in"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm hover:bg-indigo-50 shadow-sm transition-all"
          >
            <QrCode className="w-4 h-4" />
            Check In (QR / Code)
          </Link>
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-800/80 hover:bg-indigo-800 text-white font-medium text-sm border border-indigo-500/40 transition-all"
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            View Leaderboard
          </Link>
        </div>
      </div>

      {/* Risk Notice (if Medium or High) */}
      {riskData && riskData.riskLevel !== 'LOW' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-semibold text-amber-900">Engagement Support Recommended</h4>
            <p className="text-amber-700 mt-0.5">
              Your engagement status is currently{' '}
              <span className="font-bold">{riskData.riskLevel}</span>. Maintain daily attendance
              before 8:05 AM and review your recent assignments with your assigned mentor.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Attendance"
          value={`${attendanceRate}%`}
          subtitle={`${attendanceData?.summary?.present ?? 0} present, ${attendanceData?.summary?.late ?? 0} late`}
          icon={<CalendarCheck className="w-5 h-5" />}
          color={attendanceRate >= 75 ? 'emerald' : 'rose'}
        />
        <StatCard
          title="Completed Tasks"
          value={`${completedTasks} / ${tasks.length}`}
          subtitle="Mandatory & placement challenges"
          icon={<CheckSquare className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Approved Proofs"
          value={proofs.filter((p) => p.status === 'APPROVED').length}
          subtitle={`${proofs.filter((p) => p.status === 'PENDING').length} pending review`}
          icon={<Award className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Risk Category"
          value={riskData?.riskLevel || 'Not available'}
          subtitle={`Score: ${riskData?.totalScore ?? '—'}/100`}
          icon={<Clock className="w-5 h-5" />}
          color={riskData?.riskLevel === 'HIGH' ? 'rose' : riskData?.riskLevel === 'MEDIUM' ? 'amber' : 'emerald'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Assessments & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Assessments */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 text-base">Recent Assessments</h3>
              </div>
              <Link to="/assessments" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentAssessments.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No assessments assigned yet.</p>
              ) : (
                recentAssessments.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{item.assessment.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="capitalize">{item.assessment.type.toLowerCase().replace('_', ' ')}</span>
                        <span>•</span>
                        <span>{item.assessment.assessmentDate}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {item.result ? (
                        <div>
                          <span className="text-base font-bold text-slate-900">
                            {item.result.score} / {item.assessment.maxScore}
                          </span>
                          <span className="text-xs font-medium text-emerald-600 block">Graded</span>
                        </div>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-medium">
                          Pending Grading
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Tasks */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 text-base">My Tasks &amp; Milestones</h3>
              </div>
              <Link to="/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                Manage tasks <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {tasks.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No active tasks right now.</p>
              ) : (
                tasks.map((t, idx) => {
                  const sub = t.submission;
                  const isDone = sub?.progress === 'COMPLETED';
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{t.task.title}</span>
                            {t.task.isMandatory && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                Mandatory
                              </span>
                            )}
                          </div>
                          {t.task.deadline && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Deadline: {new Date(t.task.deadline).toLocaleDateString()} ({t.task.deadlineType} deadline)
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <StatusBadge status={sub?.progress || 'NOT_STARTED'} type="progress" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Events & Quick Actions */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 text-base">Events &amp; Contests</h3>
              </div>
              <Link to="/events" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                Explore <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No upcoming events listed.</p>
              ) : (
                upcomingEvents.map((e) => (
                  <div key={e.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {e.eventType}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-900 mt-1">{e.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Date: {e.eventDate ? new Date(e.eventDate).toLocaleDateString() : 'Not scheduled'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                to="/attendance/check-in"
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-indigo-600" />
                  <span>Scan QR / Check In</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                to="/proofs"
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>Submit Event Proof</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                to="/leaderboard"
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Module 18 Weekly Leaderboard</span>
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
