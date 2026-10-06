// src/pages/dashboard/CoordinatorDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { getEvents } from '../../services/events.service';
import { getProofs, reviewProof } from '../../services/proofs.service';
import { getBatches } from '../../services/batches.service';
import {
  Briefcase,
  Calendar,
  FileCheck2,
  Trophy,
  ArrowRight,
  PlusCircle,
  Check,
  X,
} from 'lucide-react';

export const CoordinatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [evList, prList, bList] = await Promise.all([
        getEvents().catch(() => []),
        getProofs().catch(() => []),
        getBatches().catch(() => []),
      ]);
      setEvents(evList);
      setProofs(prList);
      setBatches(bList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await reviewProof(id, status, remarks);
      setReviewingId(null);
      setRemarks('');
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <LoadingState message="Loading placement &amp; career readiness intelligence..." />;
  }

  const pendingProofs = proofs.filter((p) => p.status === 'PENDING');
  const totalStudents = batches.reduce((acc, b) => acc + (b.memberCount || b.members?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-700 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2 backdrop-blur-xs">
            Placement &amp; Corporate Readiness
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Placement Portal — {user?.name}</h1>
          <p className="text-blue-100 text-sm mt-1 max-w-xl">
            Track hackathons, verify student external proofs &amp; certifications, and discover top-ranked
            candidates on the weekly performance leaderboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm hover:bg-blue-50 shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Manage Events
          </Link>
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-800/80 hover:bg-indigo-900 text-white font-medium text-sm border border-indigo-400/30 transition-all"
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            Weekly High Achievers
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Placement Eligible Pool"
          value={totalStudents}
          subtitle="Enrolled students"
          icon={<Briefcase className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Active Events"
          value={events.length}
          subtitle="Hackathons &amp; challenges"
          icon={<Calendar className="w-5 h-5" />}
          color="indigo"
        />
        <StatCard
          title="Pending Proofs"
          value={pendingProofs.length}
          subtitle="Certificates to verify"
          icon={<FileCheck2 className="w-5 h-5" />}
          color={pendingProofs.length > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          title="Verified Achievements"
          value={proofs.filter((p) => p.status === 'APPROVED').length}
          subtitle="Approved credentials"
          icon={<Trophy className="w-5 h-5" />}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Proofs Review Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 text-base">Pending Proof Verification</h3>
              </div>
              <Link to="/proofs" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                View all proofs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {pendingProofs.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No proofs awaiting verification.</p>
              ) : (
                pendingProofs.map((p) => (
                  <div key={p.id} className="py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">
                            {p.student?.name || 'Student'}
                          </span>
                          <StatusBadge status={p.status} type="proof" />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Event: <span className="font-medium text-slate-700">{p.event?.title || p.eventId}</span>
                        </p>
                        <a
                          href={p.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-indigo-600 hover:underline mt-1 inline-block"
                        >
                          📄 {p.fileName}
                        </a>
                      </div>

                      <div>
                        {reviewingId === p.id ? (
                          <div className="flex flex-col items-end gap-2">
                            <input
                              type="text"
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                              placeholder="Review remarks..."
                              className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg w-44"
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleReview(p.id, 'APPROVED')}
                                className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleReview(p.id, 'REJECTED')}
                                className="px-2 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                              <button
                                onClick={() => setReviewingId(null)}
                                className="px-2 py-1 rounded border border-slate-200 text-slate-600 text-xs hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setReviewingId(p.id);
                              setRemarks('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                          >
                            Review Proof
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Events & Placement Links */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Upcoming Events</h3>
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                    {e.eventType}
                  </span>
                  <h4 className="text-xs font-semibold text-slate-900 mt-1">{e.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Date: {new Date(e.eventDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
