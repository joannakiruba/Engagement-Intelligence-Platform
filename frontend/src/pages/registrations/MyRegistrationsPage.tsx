import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyRegistrations, cancelRegistration } from '../../services/event-registrations.service';
import { EventRegistration } from '../../types';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { getErrorMessage } from '../../services/api';
import {
  Ticket,
  Calendar,
  XCircle,
  ExternalLink,
  CalendarCheck,
} from 'lucide-react';

function eventTypeBadge(eventType?: string) {
  const map: Record<string, string> = {
    HACKATHON: 'bg-purple-50 text-purple-700 border-purple-200',
    CONTEST: 'bg-blue-50 text-blue-700 border-blue-200',
    WORKSHOP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PLACEMENT_DRIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  const cls = map[eventType || ''] || 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cls}`}>
      {eventType || 'EVENT'}
    </span>
  );
}

export const MyRegistrationsPage: React.FC = () => {
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyRegistrations();
      setRegistrations(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancel = async (id: string, eventTitle?: string) => {
    if (!confirm(`Cancel registration for "${eventTitle || 'this event'}"?`)) return;
    try {
      await cancelRegistration(id);
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) {
    return <LoadingState message="Loading your event registrations..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  const upcoming = registrations.filter(
    (r) => r.event && new Date(r.event.eventDate) >= new Date(),
  );
  const past = registrations.filter(
    (r) => r.event && new Date(r.event.eventDate) < new Date(),
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <Ticket className="w-3.5 h-3.5" />
            My Registrations
          </div>
          <h1 className="text-2xl font-black tracking-tight">Event Registrations</h1>
          <p className="text-emerald-100 text-sm mt-1 max-w-2xl">
            Track your hackathon, contest, and workshop sign-ups. Cancel upcoming registrations or
            view past participation.
          </p>
        </div>

        <Link
          to="/events"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-900 font-semibold text-xs hover:bg-emerald-50 shadow-sm transition-all shrink-0"
        >
          <Calendar className="w-4 h-4" />
          Browse Events
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-slate-900">{registrations.length}</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-emerald-600">{upcoming.length}</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Upcoming</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-black text-slate-400">{past.length}</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Past</p>
        </div>
      </div>

      {registrations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">No registrations yet.</p>
          <p className="text-xs text-slate-400 mt-1">
            Browse <Link to="/events" className="text-indigo-600 hover:underline">Events &amp; Hackathons</Link> to sign up.
          </p>
        </div>
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-500" />
                Upcoming Events ({upcoming.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((reg) => (
                  <div
                    key={reg.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-emerald-300 hover:shadow-md transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        {eventTypeBadge(reg.event?.eventType)}
                      </div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        {reg.event?.title || 'Untitled Event'}
                      </h3>
                      <div className="mt-3 pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Event Date:{' '}
                            <strong>{new Date(reg.event!.eventDate).toLocaleDateString()}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Registered:{' '}
                            {new Date(reg.registeredAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => handleCancel(reg.id, reg.event?.title)}
                        className="flex-1 py-2 rounded-lg border border-red-200 text-red-600 font-semibold text-xs hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                      <Link
                        to="/events"
                        className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="View event details"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                Past Events ({past.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.map((reg) => (
                  <div
                    key={reg.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 opacity-70 flex flex-col"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {eventTypeBadge(reg.event?.eventType)}
                      <span className="text-[10px] font-medium text-slate-400">Completed</span>
                    </div>
                    <h3 className="font-bold text-slate-700 text-base leading-snug">
                      {reg.event?.title || 'Untitled Event'}
                    </h3>
                    <div className="mt-3 pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(reg.event!.eventDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
