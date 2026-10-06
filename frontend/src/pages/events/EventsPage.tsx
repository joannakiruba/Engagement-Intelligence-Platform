// src/pages/events/EventsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEvents, createEvent, registerForEvent } from '../../services/events.service';
import { EventItem } from '../../types';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { Modal } from '../../components/common/Modal';
import { getErrorMessage } from '../../services/api';
import {
  Calendar,
  PlusCircle,
  Clock,
  CheckCircle2,
  Send,
} from 'lucide-react';

export const EventsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [registeredMap, setRegisteredMap] = useState<Record<string, boolean>>({});

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventItem['eventType']>('HACKATHON');
  const [eventDate, setEventDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = hasPermission('events:create');
  const isStudent = user?.role === 'STUDENT';

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getEvents();
      setEvents(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegister = async (eventId: string) => {
    try {
      await registerForEvent(eventId);
      setRegisteredMap((prev) => ({ ...prev, [eventId]: true }));
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) return;
    try {
      setSubmitting(true);
      await createEvent({
        title: title.trim(),
        description: description.trim(),
        eventType,
        eventDate: new Date(eventDate).toISOString(),
        registrationDeadline: deadline ? new Date(deadline).toISOString() : undefined,
      });
      setModalOpen(false);
      setTitle('');
      setDescription('');
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading events, hackathons, and placement drives..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2 backdrop-blur-xs">
            <Calendar className="w-3.5 h-3.5" />
            Module 17 Events &amp; Placement Challenges
          </div>
          <h1 className="text-2xl font-black tracking-tight">Hackathons, Contests &amp; Workshops</h1>
          <p className="text-blue-100 text-sm mt-1 max-w-2xl">
            Register for internal and national competitive events. Upload verifiable certificates or rank
            proofs for institutional placement readiness scoring.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-900 font-semibold text-xs hover:bg-blue-50 shadow-sm transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            Host New Event
          </button>
        )}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.map((evt) => {
          const isRegistered = registeredMap[evt.id];
          return (
            <div
              key={evt.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {evt.eventType}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {evt._count?.registrations || 0} Registered
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base leading-snug">{evt.title}</h3>
                <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                  {evt.description || 'Inter-college competitive event for skills verification.'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Event Date: <strong>{new Date(evt.eventDate).toLocaleDateString()}</strong></span>
                  </div>
                  {evt.registrationDeadline && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Registration Ends: {new Date(evt.registrationDeadline).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {isStudent && (
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {isRegistered ? (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Registered
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRegister(evt.id)}
                      className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs"
                    >
                      Register Now
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Host Event Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New Event / Hackathon"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Event Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. State-Level IoT Hackathon 2026"
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Event Type</label>
            <select
              value={eventType}
              onChange={(e: any) => setEventType(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            >
              <option value="HACKATHON">HACKATHON</option>
              <option value="CONTEST">CONTEST</option>
              <option value="WORKSHOP">WORKSHOP</option>
              <option value="PLACEMENT_DRIVE">PLACEMENT_DRIVE</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Event Date *</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Registration Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event guidelines and prize tracks..."
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
            >
              <Send className="w-3.5 h-3.5 inline mr-1" /> Host Event
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
