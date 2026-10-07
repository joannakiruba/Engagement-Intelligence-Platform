import { useEffect, useState } from 'react';
import { getExcusedRecords, updateAttendance } from '../../services/attendance.service';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ExcusedRecord {
  id: string;
  studentId: string;
  remarks: string | null;
  createdAt: string;
  student: { id: string; name: string; email: string };
  session: { id: string; title: string; scheduledDate: string };
  window: { id: string; label: string };
}

export default function ExcusedReview() {
  const [records, setRecords] = useState<ExcusedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchId, setBatchId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRemarks, setEditRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (batchId) params.batchId = batchId;
      if (sessionId) params.sessionId = sessionId;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await getExcusedRecords(params);
      setRecords(res.data);
    } catch {
      setRecords([]);
    }
    setLoading(false);
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    loadData();
  }

  function startEdit(record: ExcusedRecord) {
    setEditingId(record.id);
    setEditRemarks(record.remarks || '');
  }

  async function saveRemarks(id: string) {
    setSaving(true);
    try {
      await updateAttendance(id, { remarks: editRemarks });
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, remarks: editRemarks } : r))
      );
      setEditingId(null);
    } catch {
      alert('Failed to save remarks');
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Excused Review</h1>
        <p className="text-gray-500 text-sm">Review and record reasons for excused absences</p>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Batch ID</label>
          <input
            type="text"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="Filter by batch..."
            className="border rounded px-3 py-1.5 text-sm w-48"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Session ID</label>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Filter by session..."
            className="border rounded px-3 py-1.5 text-sm w-48"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
          Apply
        </button>
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-600">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3 w-24">Action</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec) => {
              const date = new Date(rec.session.scheduledDate);
              const isEditing = editingId === rec.id;

              return (
                <tr key={rec.id} className="border-t text-sm">
                  <td className="px-4 py-2">
                    <div className="font-medium">{rec.student.name}</div>
                    <div className="text-xs text-gray-400">{rec.student.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-2">{rec.session.title}</td>
                  <td className="px-4 py-2">{date.toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-gray-500">{DAY_NAMES[date.getDay()]}</td>
                  <td className="px-4 py-2 text-gray-500">{rec.window.label}</td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editRemarks}
                        onChange={(e) => setEditRemarks(e.target.value)}
                        className="border rounded px-2 py-1 text-sm w-full"
                        placeholder="Enter reason for excusal..."
                        autoFocus
                      />
                    ) : (
                      <span className={rec.remarks ? 'text-gray-700' : 'text-gray-400 italic'}>
                        {rec.remarks || 'No reason recorded'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveRemarks(rec.id)}
                          disabled={saving}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(rec)}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No excused records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
