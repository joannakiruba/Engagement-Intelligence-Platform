// src/pages/proofs/ProofsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getProofs, getMyProofs, submitProof, reviewProof } from '../../services/proofs.service';
import { getEvents } from '../../services/events.service';
import { ProofSubmission, EventItem } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { getErrorMessage } from '../../services/api';
import {
  FileCheck2,
  Upload,
  Check,
  X,
  ExternalLink,
  PlusCircle,
} from 'lucide-react';

export const ProofsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proofs, setProofs] = useState<ProofSubmission[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  // Student upload form
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);

  // Review state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  const isStudent = user?.role === 'STUDENT';
  const canReview = hasPermission('proofs:approve:batch') || hasPermission('proofs:approve:any');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pList, eList] = await Promise.all([
        isStudent ? getMyProofs() : getProofs(),
        getEvents(),
      ]);
      setProofs(pList);
      setEvents(eList);
      if (eList.length > 0 && !selectedEventId) {
        setSelectedEventId(eList[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !selectedFile) return;
    try {
      setSubmittingProof(true);
      await submitProof(selectedEventId, selectedFile);
      setSelectedFile(null);
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      if (fileInput) fileInput.value = '';
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setReviewSaving(true);
      await reviewProof(id, status, reviewRemarks.trim() || undefined);
      setReviewingId(null);
      setReviewRemarks('');
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setReviewSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading proof verification and evidence records..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <FileCheck2 className="w-3.5 h-3.5" />
            Module 17 Evidence Collection System
          </div>
          <h1 className="text-2xl font-black tracking-tight">Proof Submissions &amp; Certifications</h1>
          <p className="text-blue-100 text-sm mt-1 max-w-2xl">
            Students upload evidence documents (PDF/images) for hackathons, coding contests, and certifications.
            Staff verifies proofs for placement scoring.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* If Student: Upload form */}
        {isStudent && (
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs h-fit space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              Upload Event Evidence
            </h3>

            <form onSubmit={handleSubmitProof} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Event *</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs"
                  required
                >
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.eventType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Upload File *</label>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Accepted formats: PNG, JPEG, GIF, PDF (Max 10MB)
                </span>
              </div>

              <button
                type="submit"
                disabled={submittingProof}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                <PlusCircle className="w-4 h-4" /> Submit Proof
              </button>
            </form>
          </div>
        )}

        {/* Proofs List */}
        <div className={`${isStudent ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              {isStudent ? 'My Submitted Proofs' : 'All Student Submissions'} ({proofs.length})
            </h3>
            <span className="text-xs text-slate-500">
              Approved proofs boost contest weighting in Module 18
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {proofs.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No proof submissions found.
              </div>
            ) : (
              proofs.map((p) => (
                <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">
                        {p.event?.title || p.eventId}
                      </span>
                      <StatusBadge status={p.status} type="proof" />
                    </div>

                    {!isStudent && p.student && (
                      <p className="text-xs text-slate-500">
                        Submitted by: <strong className="text-slate-800">{p.student.name}</strong> ({p.student.email})
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs">
                      <a
                        href={p.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        📄 {p.fileName} <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>

                    {p.remarks && (
                      <p className="text-xs text-slate-600 italic bg-slate-50 px-2 py-1 rounded mt-1">
                        Review remarks: &ldquo;{p.remarks}&rdquo;
                      </p>
                    )}
                  </div>

                  {canReview && (
                    <div className="shrink-0 flex items-center gap-2">
                      {reviewingId === p.id ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <input
                            type="text"
                            value={reviewRemarks}
                            onChange={(e) => setReviewRemarks(e.target.value)}
                            placeholder="Approval remarks..."
                            className="text-xs px-2 py-1 border border-slate-300 rounded-lg w-44"
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleReview(p.id, 'APPROVED')}
                              disabled={reviewSaving}
                              className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => handleReview(p.id, 'REJECTED')}
                              disabled={reviewSaving}
                              className="px-2 py-1 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700 flex items-center gap-1"
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                            <button
                              onClick={() => setReviewingId(null)}
                              className="px-2 py-1 border border-slate-200 text-slate-600 text-xs rounded hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setReviewingId(p.id);
                            setReviewRemarks(p.remarks || '');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
