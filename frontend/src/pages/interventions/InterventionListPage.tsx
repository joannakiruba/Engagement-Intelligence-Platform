// src/pages/interventions/InterventionListPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getInterventions } from '../../services/interventions.service';
import { Intervention } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { getErrorMessage } from '../../services/api';
import {
  LifeBuoy,
  PlusCircle,
  Clock,
  ArrowRight,
  Search,
} from 'lucide-react';

export const InterventionListPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const canCreate = hasPermission('interventions:create:assigned');

  useEffect(() => {
    loadInterventions();
  }, []);

  const loadInterventions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getInterventions();
      setInterventions(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading intervention tracking roster..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadInterventions} />;
  }

  const filtered = interventions.filter((item) => {
    const matchSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.mentor?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-indigo-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <LifeBuoy className="w-3.5 h-3.5" />
            Module 15 &amp; 16 Structured Interventions
          </div>
          <h1 className="text-2xl font-black tracking-tight">Student Academic &amp; Attendance Interventions</h1>
          <p className="text-teal-100 text-sm mt-1 max-w-2xl">
            Formal recovery cycles: Set specific catch-up milestones, log weekly progress notes,
            and assess long-term student outcomes.
          </p>
        </div>

        {canCreate && (
          <Link
            to="/interventions/create"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-teal-800 font-semibold text-xs hover:bg-teal-50 shadow-sm transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            Create Intervention
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, student, mentor..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st.toLowerCase().replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Interventions List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No interventions found matching criteria.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                    <StatusBadge status={item.status} type="progress" />
                    {item.outcome && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Outcome: {item.outcome.outcome}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <span>
                      Mentee: <strong className="text-slate-800">{item.student?.name || 'Student'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Mentor: <strong className="text-slate-800">{item.mentor?.name || 'Mentor'}</strong>
                    </span>
                    {item.deadline && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Deadline: {new Date(item.deadline).toLocaleDateString()}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{item.updates?.length || 0} updates logged</span>
                  </div>
                </div>

                <div className="shrink-0 w-full md:w-auto flex justify-end">
                  <Link
                    to={`/interventions/${item.id}`}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-2xs"
                  >
                    View Timeline &amp; Notes
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
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
