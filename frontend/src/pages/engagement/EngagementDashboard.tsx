// src/pages/engagement/EngagementDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  getEngagementDashboard,
  getBatchEngagement,
  getBatchTrends,
  getStudentEngagement,
} from '../../services/engagement.service';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Modal } from '../../components/common/Modal';
import { getErrorMessage } from '../../services/api';
import {
  BarChart3,
  Users,
  Layers,
  CalendarCheck,
  Award,
  AlertTriangle,
  TrendingUp,
  User,
  Search,
} from 'lucide-react';

export const EngagementDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchData, setBatchData] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [searchStudent, setSearchStudent] = useState('');

  // Student modal inspection
  const [inspectedStudent, setInspectedStudent] = useState<any>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);

  // Load Dashboard Overview
  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getEngagementDashboard();
      setOverview(res);
      if (res.batches && res.batches.length > 0 && !selectedBatchId) {
        setSelectedBatchId(res.batches[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Load selected batch breakdown & trends
  useEffect(() => {
    if (!selectedBatchId) return;
    const loadBatch = async () => {
      try {
        const [bRes, tRes] = await Promise.all([
          getBatchEngagement(selectedBatchId),
          getBatchTrends(selectedBatchId),
        ]);
        setBatchData(bRes);
        setTrends(tRes.sessions || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadBatch();
  }, [selectedBatchId]);

  const handleInspectStudent = async (studentId: string) => {
    try {
      setStudentLoading(true);
      setStudentModalOpen(true);
      const res = await getStudentEngagement(studentId);
      setInspectedStudent(res);
    } catch (err) {
      console.error(err);
    } finally {
      setStudentLoading(false);
    }
  };

  if (loading && !overview) {
    return <LoadingState message="Aggregating multi-signal engagement intelligence..." />;
  }

  if (error && !overview) {
    return <ErrorState message={error} onRetry={loadOverview} />;
  }

  const filteredStudents = (batchData?.students || []).filter((s: any) =>
    s.student.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
    s.student.email.toLowerCase().includes(searchStudent.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <BarChart3 className="w-3.5 h-3.5" />
            Institutional Intelligence
          </div>
          <h1 className="text-2xl font-black tracking-tight">Engagement &amp; Intervention Dashboard</h1>
          <p className="text-indigo-100 text-sm mt-1 max-w-2xl">
            Real-time analytics aggregating morning attendance signals, assessment averages, and trainer
            feedback across all departmental cohorts.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={overview?.totalStudents || 0}
          subtitle={`Across ${overview?.totalBatches || 0} training batches`}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Overall Attendance"
          value={`${overview?.attendanceRate || 0}%`}
          subtitle="Strict 8:05 AM session rate"
          icon={<CalendarCheck className="w-5 h-5" />}
          color={overview?.attendanceRate >= 75 ? 'emerald' : 'rose'}
        />
        <StatCard
          title="Avg Assessment Score"
          value={`${overview?.avgAssessmentScore || 0}%`}
          subtitle="Quizzes, assignments &amp; tests"
          icon={<Award className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Disengagement Risk"
          value={overview?.highRiskCount ?? 'N/A'}
          subtitle="Students requiring intervention"
          icon={<AlertTriangle className="w-5 h-5" />}
          color={overview?.highRiskCount > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Cohort Selector & Comparison */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Cohort Deep Dive</h3>
            <p className="text-xs text-slate-500">Select a training track to inspect per-student signals and trends</p>
          </div>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            {overview?.batches?.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.studentCount} students)
              </option>
            ))}
          </select>
        </div>

        {/* Session Attendance Trends */}
        {trends.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Session Attendance Progression
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {trends.map((t, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-medium">Session {idx + 1}</span>
                  <span className="text-xs font-semibold text-slate-800 truncate block mt-0.5" title={t.title}>
                    {t.title}
                  </span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-sm font-bold text-slate-900">{t.attendanceRate}%</span>
                    <span className="text-[10px] text-slate-400">{t.date}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div
                      className={`h-1 rounded-full ${
                        t.attendanceRate >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${t.attendanceRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-Student Breakdown Table */}
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <h4 className="font-semibold text-slate-900 text-sm">
              Enrolled Students in {batchData?.batch?.name} ({filteredStudents.length})
            </h4>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Search student..."
                className="w-full pl-9 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-3.5 py-2.5">Student</th>
                  <th className="px-3.5 py-2.5">Attendance</th>
                  <th className="px-3.5 py-2.5">Avg Assessment</th>
                  <th className="px-3.5 py-2.5">Effort Rating</th>
                  <th className="px-3.5 py-2.5">Risk Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s: any) => (
                  <tr key={s.student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3.5 py-3 font-semibold text-slate-900">
                      {s.student.name}
                      <span className="block font-normal text-[11px] text-slate-400">{s.student.email}</span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`font-bold ${s.attendanceRate >= 75 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {s.attendanceRate}%
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="font-semibold text-slate-800">{s.assessmentAverage}%</span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="font-semibold text-slate-800">{s.effortRating ?? '—'}/5</span>
                    </td>
                    <td className="px-3.5 py-3">
                      <StatusBadge status={s.riskLevel || 'Not available'} type="risk" />
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <button
                        onClick={() => handleInspectStudent(s.student.id)}
                        className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Student Detailed Modal */}
      <Modal
        isOpen={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        title={inspectedStudent ? `Student Profile — ${inspectedStudent.student.name}` : 'Student Intelligence'}
      >
        {studentLoading ? (
          <LoadingState message="Fetching individual performance history..." />
        ) : inspectedStudent ? (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Email</span>
                <span className="font-semibold text-slate-800">{inspectedStudent.student.email}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Department</span>
                <span className="font-semibold text-slate-800">{inspectedStudent.student.department || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Current Risk</span>
                <StatusBadge status={inspectedStudent.risk?.riskLevel || 'Not available'} type="risk" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Attendance Rate</span>
                <div className="text-xl font-bold text-slate-900 mt-0.5">{inspectedStudent.attendanceRate}%</div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Avg Assessment</span>
                <div className="text-xl font-bold text-slate-900 mt-0.5">{inspectedStudent.avgAssessmentScore}%</div>
              </div>
            </div>

            {inspectedStudent.risk?.factors && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <h5 className="font-bold text-amber-900 mb-1 text-xs">Multi-Signal Weakness Factors</h5>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                  <li>Attendance consistency: {inspectedStudent.risk.factors.attendanceRate}%</li>
                  <li>Assessment average: {inspectedStudent.risk.factors.avgAssessmentScore}%</li>
                  <li>Negative feedback notes: {inspectedStudent.risk.factors.negativeFeedbackCount}</li>
                  {inspectedStudent.risk.factors.decliningTrend && (
                    <li className="font-bold text-rose-700">Flagged: Rapid declining engagement trend</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
