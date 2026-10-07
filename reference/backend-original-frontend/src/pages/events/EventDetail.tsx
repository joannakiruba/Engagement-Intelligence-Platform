import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getEvent, setMyStatus, closeEventApi, reopenEventApi,
  addRoundApi, updateRoundApi, deleteRoundApi,
  getRegistrations,
  type EventItem, type EventRound, type EventRegistration,
} from '../../services/events.service';

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const [event, setEvent] = useState<EventItem | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [regStatusFilter, setRegStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showRoundForm, setShowRoundForm] = useState(false);
  const [editRound, setEditRound] = useState<EventRound | null>(null);
  const [roundName, setRoundName] = useState('');
  const [roundDate, setRoundDate] = useState('');
  const [roundDeadline, setRoundDeadline] = useState('');
  const [roundStatus, setRoundStatus] = useState('UPCOMING');

  async function loadEvent() {
    if (!id) return;
    try {
      setLoading(true);
      const ev = await getEvent(id);
      setEvent(ev);
      if (!isStudent) {
        const regs = await getRegistrations(id, regStatusFilter || undefined);
        setRegistrations(regs);
      }
      setError('');
    } catch {
      setError('Failed to load event.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvent(); }, [id]);
  useEffect(() => {
    if (!isStudent && id) {
      getRegistrations(id, regStatusFilter || undefined).then(setRegistrations).catch(() => {});
    }
  }, [regStatusFilter]);

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      INTERESTED: 'bg-blue-100 text-blue-800',
      REGISTERED: 'bg-green-100 text-green-800',
      WITHDRAWN: 'bg-gray-100 text-gray-800',
      UPCOMING: 'bg-blue-100 text-blue-800',
      ONGOING: 'bg-yellow-100 text-yellow-800',
      DONE: 'bg-green-100 text-green-800',
    };
    return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
  }

  async function handleStatusChange(status: string) {
    if (!id) return;
    try { await setMyStatus(id, status); loadEvent(); } catch { setError('Failed to update status.'); }
  }

  function openAddRound() {
    setEditRound(null); setRoundName(''); setRoundDate(''); setRoundDeadline(''); setRoundStatus('UPCOMING'); setShowRoundForm(true);
  }

  function openEditRound(r: EventRound) {
    setEditRound(r);
    setRoundName(r.name);
    setRoundDate(r.roundDate ? r.roundDate.slice(0, 10) : '');
    setRoundDeadline(r.deadline ? r.deadline.slice(0, 10) : '');
    setRoundStatus(r.status);
    setShowRoundForm(true);
  }

  async function saveRound() {
    if (!id) return;
    const data: Record<string, any> = { name: roundName };
    if (roundDate) data.roundDate = new Date(roundDate).toISOString();
    else if (editRound) data.roundDate = null;
    if (roundDeadline) data.deadline = new Date(roundDeadline).toISOString();
    if (roundStatus) data.status = roundStatus;
    try {
      if (editRound) {
        await updateRoundApi(id, editRound.id, data);
      } else {
        await addRoundApi(id, data);
      }
      setShowRoundForm(false);
      loadEvent();
    } catch { setError('Failed to save round.'); }
  }

  async function handleDeleteRound(roundId: string) {
    if (!id || !confirm('Delete this round?')) return;
    try { await deleteRoundApi(id, roundId); loadEvent(); } catch { setError('Failed to delete round.'); }
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!event) return <p className="text-red-600">{error || 'Event not found.'}</p>;

  const isClosed = !!event.closedAt;

  return (
    <div>
      <Link to="/events" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Events</Link>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${event.category === 'CODING' ? 'bg-purple-100 text-purple-800' : event.category === 'HACKATHON' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'}`}>{event.category}</span>
          {event.isMandatory ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Mandatory</span> : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Voluntary</span>}
          {isClosed && <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">Closed</span>}
        </div>
        {event.description && <p className="text-gray-600 mb-4">{event.description}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {event.startDate && <div><span className="text-gray-500">Start:</span> {new Date(event.startDate).toLocaleDateString()}</div>}
          {event.endDate && <div><span className="text-gray-500">End:</span> {new Date(event.endDate).toLocaleDateString()}</div>}
          {event.mode && <div><span className="text-gray-500">Mode:</span> {event.mode}</div>}
          {event.venue && <div><span className="text-gray-500">Venue:</span> {event.venue}</div>}
          {event.fee != null && <div><span className="text-gray-500">Fee:</span> &#8377;{event.fee}</div>}
          {event.officialLink && <div><span className="text-gray-500">Link:</span> <a href={event.officialLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Official Link</a></div>}
          {event.createdBy && <div><span className="text-gray-500">Created by:</span> {event.createdBy.name}</div>}
          {event.eventBatches && event.eventBatches.length > 0 && (
            <div><span className="text-gray-500">Batches:</span> {event.eventBatches.map(eb => eb.batch.name).join(', ')}</div>
          )}
        </div>

        {isStudent && !isClosed && (
          <div className="mt-4 flex items-center gap-3">
            {event.myStatus && <span className="text-sm">Your status: {statusBadge(event.myStatus)}</span>}
            {!event.myStatus && !event.isMandatory && (
              <button onClick={() => handleStatusChange('INTERESTED')} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded text-sm hover:bg-blue-100">Mark Interested</button>
            )}
            {(event.myStatus === 'PENDING' || event.myStatus === 'INTERESTED') && (
              <button onClick={() => handleStatusChange('REGISTERED')} className="bg-green-50 text-green-700 px-3 py-1.5 rounded text-sm hover:bg-green-100">Register</button>
            )}
            {event.myStatus && event.myStatus !== 'WITHDRAWN' && (
              <button onClick={() => handleStatusChange('WITHDRAWN')} className="bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-100">Withdraw</button>
            )}
          </div>
        )}

        {!isStudent && (
          <div className="mt-4 flex items-center gap-3">
            <Link to={`/events/${event.id}/edit`} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">Edit</Link>
            {!isClosed ? (
              <button onClick={async () => { try { await closeEventApi(event.id); loadEvent(); } catch { setError('Failed.'); } }} className="bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded text-sm hover:bg-yellow-100">Close Event</button>
            ) : (
              <button onClick={async () => { try { await reopenEventApi(event.id); loadEvent(); } catch { setError('Failed.'); } }} className="bg-green-50 text-green-700 px-3 py-1.5 rounded text-sm hover:bg-green-100">Reopen Event</button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Rounds</h2>
          {!isStudent && !isClosed && <button onClick={openAddRound} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">Add Round</button>}
        </div>

        {showRoundForm && (
          <div className="border rounded p-4 mb-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <input value={roundName} onChange={e => setRoundName(e.target.value)} placeholder="Round name" className="border rounded px-3 py-1.5 text-sm" />
              <select value={roundStatus} onChange={e => setRoundStatus(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
                <option value="UPCOMING">UPCOMING</option>
                <option value="ONGOING">ONGOING</option>
                <option value="DONE">DONE</option>
              </select>
              <input type="date" value={roundDate} onChange={e => setRoundDate(e.target.value)} className="border rounded px-3 py-1.5 text-sm" />
              <input type="date" value={roundDeadline} onChange={e => setRoundDeadline(e.target.value)} className="border rounded px-3 py-1.5 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveRound} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">{editRound ? 'Update' : 'Add'}</button>
              <button onClick={() => setShowRoundForm(false)} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        )}

        {event.rounds && event.rounds.length > 0 ? (
          <table className="min-w-full bg-white border rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Date</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Deadline</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Status</th>
                {!isStudent && <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {event.rounds.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{r.name}</td>
                  <td className="px-4 py-2 text-sm">{r.roundDate ? new Date(r.roundDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-2 text-sm">{r.deadline ? new Date(r.deadline).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-2 text-sm">{statusBadge(r.status)}</td>
                  {!isStudent && (
                    <td className="px-4 py-2 text-sm flex gap-2">
                      <button onClick={() => openEditRound(r)} className="text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDeleteRound(r.id)} className="text-red-600 hover:underline">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-sm">No rounds added yet.</p>
        )}
      </div>

      {!isStudent && (
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Registrations</h2>
            <select value={regStatusFilter} onChange={e => setRegStatusFilter(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="INTERESTED">Interested</option>
              <option value="REGISTERED">Registered</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>

          {event.statusCounts && (
            <div className="flex gap-4 mb-4 text-sm">
              {Object.entries(event.statusCounts).map(([status, count]) => (
                <span key={status} className="text-gray-600">{status}: <strong>{count as number}</strong></span>
              ))}
            </div>
          )}

          {registrations.length > 0 ? (
            <table className="min-w-full bg-white border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Student</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Email</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {registrations.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">{r.student?.name ?? r.studentId}</td>
                    <td className="px-4 py-2 text-sm">{r.student?.email ?? '-'}</td>
                    <td className="px-4 py-2 text-sm">{statusBadge(r.status)}</td>
                    <td className="px-4 py-2 text-sm">{new Date(r.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-sm">No registrations found.</p>
          )}
        </div>
      )}
    </div>
  );
}
