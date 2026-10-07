import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getEvents, getMyEvents, deleteEventApi, closeEventApi, reopenEventApi,
  setMyStatus, type EventItem,
} from '../../services/events.service';

export default function EventList() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');

  const categories = [
    { label: 'All', value: '' },
    { label: 'Coding', value: 'CODING' },
    { label: 'Hackathons', value: 'HACKATHON' },
    { label: 'Other', value: 'OTHER' },
  ];

  async function load() {
    try {
      setLoading(true);
      if (isStudent) {
        const params: Record<string, string> = {};
        if (category) params.category = category;
        const data = await getMyEvents(params);
        setEvents(data);
      } else {
        const params: Record<string, string> = {};
        if (category) params.category = category;
        const result = await getEvents(params);
        setEvents(result.data);
      }
      setError('');
    } catch {
      setError('Failed to load events.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [category]);

  function statusBadge(status: string | null | undefined) {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      INTERESTED: 'bg-blue-100 text-blue-800',
      REGISTERED: 'bg-green-100 text-green-800',
      WITHDRAWN: 'bg-gray-100 text-gray-800',
    };
    if (!status) return null;
    return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
  }

  function categoryBadge(cat: string) {
    const colors: Record<string, string> = {
      CODING: 'bg-purple-100 text-purple-800',
      HACKATHON: 'bg-indigo-100 text-indigo-800',
      OTHER: 'bg-gray-100 text-gray-600',
    };
    return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[cat] || 'bg-gray-100'}`}>{cat}</span>;
  }

  function nextRound(ev: EventItem) {
    if (!ev.rounds?.length) return null;
    return ev.rounds.find(r => r.status !== 'DONE') || null;
  }

  async function handleStatusChange(eventId: string, status: string) {
    try {
      await setMyStatus(eventId, status);
      load();
    } catch {
      setError('Failed to update status.');
    }
  }

  async function handleClose(id: string) {
    try { await closeEventApi(id); load(); } catch { setError('Failed to close event.'); }
  }

  async function handleReopen(id: string) {
    try { await reopenEventApi(id); load(); } catch { setError('Failed to reopen event.'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    try { await deleteEventApi(id); load(); } catch { setError('Failed to delete event.'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        {!isStudent && (
          <Link to="/events/create" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            Create Event
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {categories.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              category === c.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : events.length === 0 ? (
        <p className="text-gray-500">No events found.</p>
      ) : (
        <div className="grid gap-4">
          {events.map(ev => {
            const isClosed = !!ev.closedAt;
            const nr = nextRound(ev);
            return (
              <div key={ev.id} className="bg-white border rounded-lg p-4 hover:shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/events/${ev.id}`} className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                        {ev.title}
                      </Link>
                      {categoryBadge(ev.category)}
                      {ev.isMandatory && <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Mandatory</span>}
                      {!ev.isMandatory && <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Voluntary</span>}
                      {isClosed && <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">Closed</span>}
                    </div>
                    {ev.description && <p className="text-sm text-gray-600 mb-2 line-clamp-2">{ev.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {ev.fee != null && ev.fee > 0 && <span>Fee: &#8377;{ev.fee}</span>}
                      {ev.mode && <span>Mode: {ev.mode}</span>}
                      {ev.startDate && <span>Starts: {new Date(ev.startDate).toLocaleDateString()}</span>}
                      {nr && <span>Next round: {nr.name}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 ml-4">
                    {isStudent && (
                      <>
                        {ev.myStatus && statusBadge(ev.myStatus)}
                        {!isClosed && (
                          <div className="flex gap-1">
                            {!ev.myStatus && !ev.isMandatory && (
                              <button onClick={() => handleStatusChange(ev.id, 'INTERESTED')} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">Interested</button>
                            )}
                            {(ev.myStatus === 'PENDING' || ev.myStatus === 'INTERESTED') && (
                              <button onClick={() => handleStatusChange(ev.id, 'REGISTERED')} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">Register</button>
                            )}
                            {ev.myStatus && ev.myStatus !== 'WITHDRAWN' && (
                              <button onClick={() => handleStatusChange(ev.id, 'WITHDRAWN')} className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100">Withdraw</button>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {!isStudent && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{ev._count?.registrations ?? 0} registrations</span>
                        <Link to={`/events/${ev.id}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                        {!isClosed ? (
                          <button onClick={() => handleClose(ev.id)} className="text-xs text-yellow-600 hover:underline">Close</button>
                        ) : (
                          <button onClick={() => handleReopen(ev.id)} className="text-xs text-green-600 hover:underline">Reopen</button>
                        )}
                        <button onClick={() => handleDelete(ev.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
