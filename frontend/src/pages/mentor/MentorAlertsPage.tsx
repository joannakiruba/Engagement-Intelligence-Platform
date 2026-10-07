// src/pages/mentor/MentorAlertsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMentorAlerts, updateAlertStatus, recordAlertOutcome } from '../../services/mentor.service';
import { MentorAlert } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Modal } from '../../components/common/Modal';
import { getErrorMessage } from '../../services/api';
import {
  Bell,
  CheckCircle,
  Clock,
  ArrowRight,
  Send,
} from 'lucide-react';

export const MentorAlertsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<MentorAlert[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Outcome recording modal
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<MentorAlert | null>(null);
  const [mentorResponse, setMentorResponse] = useState<'acted' | 'dismissed' | 'ignored'>('acted');
  const [followedRec, setFollowedRec] = useState<boolean>(true);
  const [responseTime, setResponseTime] = useState<number>(2);
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  const loadAlerts = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      // If mentor or admin, load alerts
      const res = await getMentorAlerts(user.id);
      setAlerts(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [user]);

  const handleStatusChange = async (alertId: number, status: 'pending' | 'seen' | 'acted' | 'dismissed') => {
    try {
      await updateAlertStatus(alertId, status);
      await loadAlerts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenOutcome = (alert: MentorAlert) => {
    setActiveAlert(alert);
    setMentorResponse('acted');
    setFollowedRec(true);
    setResponseTime(2);
    setOutcomeNotes('');
    setOutcomeModalOpen(true);
  };

  const handleSubmitOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAlert) return;
    try {
      setSubmittingOutcome(true);
      await recordAlertOutcome(activeAlert.id, {
        mentor_response: mentorResponse,
        response_time_hours: responseTime,
        was_recommendation_followed: followedRec,
        outcome_notes: outcomeNotes,
      });
      setOutcomeModalOpen(false);
      await loadAlerts();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingOutcome(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading high-risk mentor alert dispatch stream..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadAlerts} />;
  }

  const filtered = statusFilter === 'all'
    ? alerts
    : alerts.filter((a) => a.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <Bell className="w-3.5 h-3.5" />
            Module 14 Automated Alert Queue
          </div>
          <h1 className="text-2xl font-black tracking-tight">Mentor Disengagement Alerts</h1>
          <p className="text-teal-100 text-sm mt-1 max-w-2xl">
            Triggered automatically when assigned mentees exceed critical risk thresholds.
            Review AI recommendation, update status, and close the loop with verified outcome notes.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['all', 'pending', 'seen', 'acted', 'dismissed'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
              statusFilter === st
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st} ({st === 'all' ? alerts.length : alerts.filter((a) => a.status === st).length})
          </button>
        ))}
      </div>

      {/* Alerts Grid */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
            No alerts matching the selected filter.
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center font-bold text-teal-800 text-sm">
                    {alert.student?.name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {alert.student?.name || `Student #${alert.studentId}`}
                      </h4>
                      <StatusBadge status={alert.riskCategory} type="risk" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Disengagement Risk Score: <strong>{alert.riskScore}/100</strong> • Dispatched: {new Date(alert.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={alert.status} type="progress" />
                </div>
              </div>

              {/* Recommendation Box */}
              <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-200/60 text-xs text-teal-950">
                <span className="font-bold">System Recommendation: </span>
                {alert.suggestedAction}
              </div>

              {/* Outcome if already recorded */}
              {alert.outcome && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <span className="font-bold">Recorded Outcome: </span>
                  Response: <span className="uppercase font-semibold">{alert.outcome.mentorResponse}</span> •{' '}
                  Recommendation Followed: {alert.outcome.wasRecommendationFollowed ? 'Yes' : 'No'}
                  {alert.outcome.outcomeNotes && ` — "${alert.outcome.outcomeNotes}"`}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {alert.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(alert.id, 'seen')}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5" /> Mark Seen
                    </button>
                  )}
                  {alert.status !== 'dismissed' && (
                    <button
                      onClick={() => handleStatusChange(alert.id, 'dismissed')}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium"
                    >
                      Dismiss
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenOutcome(alert)}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Log Mentor Action / Outcome
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Outcome Modal */}
      <Modal
        isOpen={outcomeModalOpen}
        onClose={() => setOutcomeModalOpen(false)}
        title="Record Alert Outcome &amp; Counseling Response"
      >
        <form onSubmit={handleSubmitOutcome} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mentor Action Response</label>
            <select
              value={mentorResponse}
              onChange={(e: any) => setMentorResponse(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            >
              <option value="acted">Acted (Counseling session held / Tutoring setup)</option>
              <option value="dismissed">Dismissed (False alarm / Verified excuse)</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Response Time (Hours)</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={responseTime}
              onChange={(e) => setResponseTime(Number(e.target.value))}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="followed"
              checked={followedRec}
              onChange={(e) => setFollowedRec(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <label htmlFor="followed" className="text-slate-700 font-medium">
              Was the automated suggestion followed?
            </label>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Outcome &amp; Counseling Notes</label>
            <textarea
              rows={3}
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              placeholder="e.g. Conducted 1:1 meeting with student; reviewed morning transport difficulties and assigned coding practice."
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setOutcomeModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingOutcome}
              className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" /> Save Outcome
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
