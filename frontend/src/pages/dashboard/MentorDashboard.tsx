// src/pages/dashboard/MentorDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { getMentorAlerts, updateAlertStatus } from '../../services/mentor.service';
import { getHighRiskStudents } from '../../services/risk.service';
import { getInterventions } from '../../services/interventions.service';
import { getMentorAssignments } from '../../services/mentor.service';
import { getBatches, getSessions } from '../../services/batches.service';
import {
  Bell,
  AlertTriangle,
  LifeBuoy,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  PlusCircle,
  Eye,
  QrCode,
} from 'lucide-react';

export const MentorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [highRisks, setHighRisks] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [assignedCount, setAssignedCount] = useState<number>(0);
  const [sessions, setSessions] = useState<any[]>([]);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [al, hr, interv, assign, b] = await Promise.all([
        getMentorAlerts(user.id).catch(() => []),
        getHighRiskStudents().catch(() => []),
        getInterventions().catch(() => []),
        getMentorAssignments({ mentorId: user.id }).catch(() => []),
        getBatches().catch(() => []),
      ]);
      setAlerts(al);
      setHighRisks(hr);
      setInterventions(interv);
      setAssignedCount(assign.length);
      const sessionResults = await Promise.all(
        b.map((batch: any) => getSessions(batch.id).catch(() => []))
      );
      setSessions(sessionResults.flat());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleUpdateAlert = async (alertId: number, status: 'seen' | 'acted' | 'dismissed') => {
    try {
      await updateAlertStatus(alertId, status);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <LoadingState message="Loading mentor intelligence &amp; intervention portal..." />;
  }

  const pendingAlerts = alerts.filter((a) => a.status === 'pending');
  const activeInterventions = interventions.filter((i) => i.status === 'IN_PROGRESS' || i.status === 'PENDING');

  return (
    <div className="space-y-6">
      {/* Mentor Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-700 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2 backdrop-blur-xs">
            Mentor &amp; Intervention Intelligence
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Mentor Portal — {user?.name}</h1>
          <p className="text-teal-100 text-sm mt-1 max-w-xl">
            Monitor real-time disengagement risk signals, receive automated ML escalation alerts,
            and structure student recovery interventions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/interventions/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-teal-800 font-semibold text-sm hover:bg-teal-50 shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Create Intervention
          </Link>
          <Link
            to="/attendance/overview"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-teal-800 font-semibold text-sm hover:bg-teal-50 shadow-sm transition-all"
          >
            <QrCode className="w-4 h-4" />
            Launch QR
          </Link>
          <Link
            to="/mentor-alerts"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-800/80 hover:bg-teal-900 text-white font-medium text-sm border border-teal-400/30 transition-all"
          >
            <Bell className="w-4 h-4" />
            View Alerts ({pendingAlerts.length})
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Mentees"
          value={assignedCount}
          subtitle="Students under mentorship"
          icon={<Users className="w-5 h-5" />}
          color="indigo"
        />
        <StatCard
          title="Pending Alerts"
          value={pendingAlerts.length}
          subtitle="Require mentor action"
          icon={<Bell className="w-5 h-5" />}
          color={pendingAlerts.length > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          title="Active Interventions"
          value={activeInterventions.length}
          subtitle={`${interventions.filter((i) => i.status === 'COMPLETED').length} completed`}
          icon={<LifeBuoy className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="High/Med Risk Mentees"
          value={highRisks.length}
          subtitle="Flagged by risk engine"
          icon={<AlertTriangle className="w-5 h-5" />}
          color={highRisks.length > 0 ? 'amber' : 'emerald'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent Alerts Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-rose-600" />
                <h3 className="font-semibold text-slate-900 text-base">High-Risk Alerts Feed</h3>
              </div>
              <Link to="/mentor-alerts" className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">
                View all ({alerts.length}) <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  No disengagement risk alerts pending for your assigned students!
                </div>
              ) : (
                alerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">
                            {alert.student?.name || `Student #${alert.studentId}`}
                          </span>
                          <StatusBadge status={alert.riskCategory} type="risk" />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Risk Score: <span className="font-semibold text-slate-800">{alert.riskScore}/100</span> • Created: {new Date(alert.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={alert.status} type="progress" />
                    </div>

                    <div className="text-xs bg-amber-50/80 border border-amber-200/60 rounded-lg p-2.5 text-amber-900">
                      <span className="font-semibold">Suggested Action: </span>
                      {alert.suggestedAction}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Link
                        to={`/interventions/create?studentId=${alert.studentId}`}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
                      >
                        Create Intervention <ArrowRight className="w-3 h-3" />
                      </Link>

                      {alert.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateAlert(alert.id, 'seen')}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
                          >
                            Mark Seen
                          </button>
                          <button
                            onClick={() => handleUpdateAlert(alert.id, 'acted')}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                          >
                            Mark Acted
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Interventions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-slate-900 text-base">Active Interventions</h3>
              </div>
              <Link to="/interventions" className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">
                Manage interventions <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {interventions.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No active interventions created yet.</p>
              ) : (
                interventions.slice(0, 4).map((i) => (
                  <div key={i.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-900">{i.title}</h4>
                        <StatusBadge status={i.status} type="progress" />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Student: <span className="font-medium text-slate-700">{i.student?.name}</span>
                        {i.deadline && ` • Deadline: ${new Date(i.deadline).toLocaleDateString()}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/interventions/${i.id}`}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50"
                      >
                        Details &amp; Notes
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: QR, High Risk Mentees & Guidance */}
        <div className="space-y-6">
          {/* QR Attendance Sessions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-slate-900 text-sm">QR Attendance</h3>
              </div>
              <Link to="/attendance/overview" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
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
                      className="shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors inline-flex items-center gap-1"
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
            <h3 className="font-semibold text-slate-900 text-sm mb-3">High-Risk Mentees</h3>
            <div className="space-y-3">
              {highRisks.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No high-risk students found.</p>
              ) : (
                highRisks.slice(0, 5).map((r) => (
                  <div key={r.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">
                        {r.student?.name || r.studentId}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Attendance: {r.factors?.attendanceRate || 0}% • Avg: {r.factors?.avgAssessmentScore || 0}%
                      </span>
                    </div>
                    <StatusBadge status={r.riskLevel} type="risk" />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-xs text-slate-600 space-y-2">
            <h4 className="font-bold text-slate-900 text-sm">Agentic Intervention Cycle</h4>
            <p className="leading-relaxed">
              1. <strong>Review Signals:</strong> Multi-signal analysis from morning attendance, assessment quizzes &amp; trainer feedback.
            </p>
            <p className="leading-relaxed">
              2. <strong>Detect Pattern:</strong> Rule triggers (+20 attendance, +25 score, +15 feedback) escalated by ML Logistic Regression.
            </p>
            <p className="leading-relaxed">
              3. <strong>Act:</strong> Create intervention task, log progress notes, and record final outcome (Improved/Declined).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
