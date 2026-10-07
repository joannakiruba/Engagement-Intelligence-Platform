// src/pages/interventions/InterventionDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getIntervention,
  updateIntervention,
  addInterventionUpdate,
  logInterventionOutcome,
} from '../../services/interventions.service';
import { Intervention } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Modal } from '../../components/common/Modal';
import { getErrorMessage } from '../../services/api';
import {
  LifeBuoy,
  ArrowLeft,
  Clock,
  PlusCircle,
  CheckCircle,
  MessageSquare,
  AlertCircle,
  Send,
} from 'lucide-react';

export const InterventionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intervention, setIntervention] = useState<Intervention | null>(null);

  // New note form
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Outcome modal
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'IMPROVED' | 'NO_CHANGE' | 'DECLINED'>('IMPROVED');
  const [outcomeRemarks, setOutcomeRemarks] = useState('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  const canEdit = hasPermission('interventions:update:own') && (user?.id === intervention?.mentorId || user?.role === 'ADMIN');
  const canLogOutcome = hasPermission('interventions:log_outcome:own') && (user?.id === intervention?.mentorId || user?.role === 'ADMIN');

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getIntervention(id);
      setIntervention(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !id) return;
    try {
      setSubmittingNote(true);
      await addInterventionUpdate(id, newNote.trim());
      setNewNote('');
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleLogOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSubmittingOutcome(true);
      await logInterventionOutcome(id, outcomeType, outcomeRemarks);
      setOutcomeModalOpen(false);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const handleStatusChange = async (status: Intervention['status']) => {
    if (!id) return;
    try {
      await updateIntervention(id, { status });
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) {
    return <LoadingState message="Loading intervention record details..." />;
  }

  if (error || !intervention) {
    return <ErrorState message={error || 'Intervention not found'} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/interventions"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Interventions
      </Link>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <StatusBadge status={intervention.status} type="progress" />
              {intervention.riskScore && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  Risk Level: {intervention.riskScore.riskLevel}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{intervention.title}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Created {new Date(intervention.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && intervention.status !== 'COMPLETED' && (
              <select
                value={intervention.status}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden"
              >
                <option value="PENDING" disabled>Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            )}

            {canLogOutcome && !intervention.outcome && intervention.status !== 'CANCELLED' && (
              <button
                onClick={() => setOutcomeModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Log Final Outcome
              </button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50/60 border border-slate-200/60 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Mentee (Student)</span>
            <span className="font-semibold text-slate-900 text-sm">{intervention.student?.name}</span>
            <span className="block text-slate-500 text-[11px]">{intervention.student?.email}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Assigned Mentor</span>
            <span className="font-semibold text-slate-900 text-sm">{intervention.mentor?.name}</span>
            <span className="block text-slate-500 text-[11px]">{intervention.mentor?.email}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Target Deadline</span>
            <span className="font-semibold text-slate-900 text-sm">
              {intervention.deadline ? new Date(intervention.deadline).toLocaleDateString() : 'Self-paced'}
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Intervention Strategy &amp; Goals</h3>
          <p className="text-sm text-slate-700 bg-slate-50/40 p-4 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">
            {intervention.description}
          </p>
        </div>

        {/* Logged Outcome Box */}
        {intervention.outcome && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-sm">Intervention Concluded: {intervention.outcome.outcome}</span>
            </div>
            {intervention.outcome.remarks && (
              <p className="text-emerald-800 mt-1 pl-6">
                &ldquo;{intervention.outcome.remarks}&rdquo;
              </p>
            )}
            <div className="text-[10px] text-emerald-600 pl-6 mt-1">
              Recorded on {new Date(intervention.outcome.recordedAt).toLocaleString()}
            </div>
          </div>
        )}

        {/* Progress Notes Timeline */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            Weekly Progress Updates ({intervention.updates?.length || 0})
          </h3>

          {/* Form to add note */}
          {canEdit && !['COMPLETED', 'CANCELLED'].includes(intervention.status) && (
            <form onSubmit={handleAddNote} className="mb-6 space-y-2">
              <textarea
                rows={2}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log observation from meeting, lab session, or attendance check..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingNote || !newNote.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Add Progress Note
                </button>
              </div>
            </form>
          )}

          {/* Notes list */}
          <div className="space-y-3">
            {(!intervention.updates || intervention.updates.length === 0) ? (
              <p className="text-xs text-slate-400 py-3 italic">No updates logged yet.</p>
            ) : (
              intervention.updates.map((upd) => (
                <div key={upd.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-700">Progress Update</span>
                    <span>{new Date(upd.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{upd.note}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Outcome Modal */}
      <Modal
        isOpen={outcomeModalOpen}
        onClose={() => setOutcomeModalOpen(false)}
        title="Log Final Intervention Outcome"
      >
        <form onSubmit={handleLogOutcome} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observed Outcome</label>
            <select
              value={outcomeType}
              onChange={(e: any) => setOutcomeType(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            >
              <option value="IMPROVED">IMPROVED — Student recovered engagement and met milestone</option>
              <option value="NO_CHANGE">NO_CHANGE — Minimal progress observed; may require escalation</option>
              <option value="DECLINED">DECLINED — Persistent disengagement</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Remarks &amp; Closing Assessment</label>
            <textarea
              rows={3}
              value={outcomeRemarks}
              onChange={(e) => setOutcomeRemarks(e.target.value)}
              placeholder="Summary notes regarding student turnaround, lab attendance, and marks..."
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
              <CheckCircle className="w-3.5 h-3.5" /> Save Final Outcome
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
