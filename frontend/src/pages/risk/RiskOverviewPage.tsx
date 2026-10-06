// src/pages/risk/RiskOverviewPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getHighRiskStudents, calculateStudentRisk } from '../../services/risk.service';
import { RiskScore } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { getErrorMessage } from '../../services/api';
import {
  AlertTriangle,
  RefreshCw,
  Cpu,
  ArrowRight,
  TrendingDown,
  LifeBuoy,
} from 'lucide-react';

export const RiskOverviewPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskList, setRiskList] = useState<RiskScore[]>([]);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getHighRiskStudents();
      setRiskList(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecalculate = async (studentId: string, batchId?: string) => {
    if (!batchId) return;
    try {
      setCalculatingId(studentId);
      await calculateStudentRisk(studentId, batchId);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setCalculatingId(null);
    }
  };

  if (loading) {
    return <LoadingState message="Running hybrid rule-based and ML risk engine evaluation..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-orange-700 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <Cpu className="w-3.5 h-3.5" />
            Module 12 Hybrid Risk Engine
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-rose-200" />
            Disengagement Risk &amp; Weakness Analysis
          </h1>
          <p className="text-rose-100 text-sm mt-1 max-w-2xl">
            Stateful multi-signal agentic detection combining deterministic rules (+20 attendance, +25 assessments, +15 feedback)
            with ML Logistic Regression escalation.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-rose-700 font-semibold text-xs hover:bg-rose-50 shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Risk Pipeline
        </button>
      </div>

      {/* Rules Legend Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-amber-600" />
            Attendance Signal (+20)
          </div>
          <p className="text-slate-600">
            Attendance rate strictly below 75% across morning 8:05 AM sessions triggers a +20 risk penalty.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            Assessment Signal (+25)
          </div>
          <p className="text-slate-600">
            Average score strictly below 50% across technical quizzes and coding assignments triggers a +25 risk penalty.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
          <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-purple-600" />
            Feedback Signal (+15)
          </div>
          <p className="text-slate-600">
            Trainer observations with effort or participation rated ≤ 2/5 trigger an additional +15 risk penalty.
          </p>
        </div>
      </div>

      {/* Flagged Students List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">
            Flagged Students ({riskList.length})
          </h3>
          <span className="text-xs text-slate-500">
            Low (0-30) • Medium (31-60) • High (61-100)
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {riskList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No students currently flagged in Medium or High risk categories.
            </div>
          ) : (
            riskList.map((r) => (
              <div key={r.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">
                      {r.student?.name || `Student #${r.studentId}`}
                    </h4>
                    <StatusBadge status={r.riskLevel} type="risk" />
                    <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-900 text-white">
                      Score: {r.totalScore}/100
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">
                    {r.student?.email} • {r.student?.department || 'Computer Science'}
                  </p>

                  {/* Signals pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      Attendance: <strong>{r.factors?.attendanceRate || 0}%</strong> (Risk +{r.attendanceRisk})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      Assessment Avg: <strong>{r.factors?.avgAssessmentScore || 0}%</strong> (Risk +{r.assessmentRisk})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      Negative Feedback: <strong>{r.factors?.negativeFeedbackCount || 0}</strong> (Risk +{r.feedbackRisk})
                    </span>
                    {r.factors?.mlSuggestedEscalation && (
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                        ML Escalated
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
                  <button
                    onClick={() => handleRecalculate(r.studentId, r.factors?.scope?.batchId)}
                    disabled={calculatingId === r.studentId}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${calculatingId === r.studentId ? 'animate-spin' : ''}`} />
                    Recalculate
                  </button>

                  <Link
                    to={`/interventions/create?studentId=${r.studentId}`}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <LifeBuoy className="w-3.5 h-3.5" />
                    Intervene
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
