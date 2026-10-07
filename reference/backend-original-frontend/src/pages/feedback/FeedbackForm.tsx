import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createFeedback, getFeedback, updateFeedback } from '../../services/feedback.service';
import { getRoster } from '../../services/batches.service';
import { getSessions } from '../../services/batches.service';

interface StudentRow {
  studentId: string;
  studentName: string;
  effortRating: number;
  participationRating: number;
  comments: string;
}

export default function FeedbackForm() {
  const { id, sessionId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [singleSessionId, setSingleSessionId] = useState(sessionId || '');
  const [singleStudentId, setSingleStudentId] = useState('');
  const [effortRating, setEffortRating] = useState(3);
  const [participationRating, setParticipationRating] = useState(3);
  const [comments, setComments] = useState('');

  const [batchId, setBatchId] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [bulkMode, setBulkMode] = useState(Boolean(sessionId) && !id);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      getFeedback(id).then(fb => {
        setSingleSessionId(fb.sessionId);
        setSingleStudentId(fb.studentId);
        setEffortRating(fb.effortRating);
        setParticipationRating(fb.participationRating);
        setComments(fb.comments || '');
      }).catch(() => setError('Failed to load feedback record.'));
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (bulkMode && batchId) {
      getRoster(batchId).then((roster: any[]) => {
        setStudents(roster.map((m: any) => ({
          studentId: m.student?.id ?? m.studentId,
          studentName: m.student?.name ?? m.studentId,
          effortRating: 3,
          participationRating: 3,
          comments: '',
        })));
      }).catch(() => setError('Failed to load roster.'));
    }
  }, [batchId, bulkMode]);

  function updateStudentField(index: number, field: keyof StudentRow, value: string | number) {
    setStudents(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isEdit && id) {
        await updateFeedback(id, { effortRating, participationRating, comments: comments || undefined });
        setSuccess('Feedback updated.');
      } else {
        await createFeedback({
          sessionId: singleSessionId,
          studentId: singleStudentId,
          effortRating,
          participationRating,
          comments: comments || undefined,
        });
        setSuccess('Feedback submitted.');
        setSingleStudentId('');
        setEffortRating(3);
        setParticipationRating(3);
        setComments('');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const records = students.map(s => ({
        studentId: s.studentId,
        effortRating: s.effortRating,
        participationRating: s.participationRating,
        comments: s.comments || undefined,
      }));

      const res = await fetch('/api/feedback/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: singleSessionId, records }),
      });
      const data = await res.json();

      if (data.success) {
        const skipped = data.data.skipped?.length || 0;
        setSuccess(`Created ${data.data.created} of ${data.data.total} records.${skipped > 0 ? ` ${skipped} skipped.` : ''}`);
      } else {
        setError(data.error || 'Bulk submission failed.');
      }
    } catch {
      setError('Failed to submit bulk feedback.');
    } finally {
      setLoading(false);
    }
  }

  const ratingOptions = [1, 2, 3, 4, 5];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Feedback' : 'Give Feedback'}
        </h1>
        <button onClick={() => navigate('/feedback')} className="text-sm text-gray-600 hover:underline">
          Back to list
        </button>
      </div>

      {!isEdit && (
        <div className="mb-4 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!bulkMode} onChange={() => setBulkMode(false)} />
            Single student
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={bulkMode} onChange={() => setBulkMode(true)} />
            Bulk (entire batch)
          </label>
        </div>
      )}

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {success && <p className="text-green-600 mb-4">{success}</p>}

      {(!bulkMode || isEdit) ? (
        <form onSubmit={handleSingleSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session ID</label>
            <input
              type="text"
              value={singleSessionId}
              onChange={e => setSingleSessionId(e.target.value)}
              disabled={isEdit}
              required
              className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
              <input
                type="text"
                value={singleStudentId}
                onChange={e => setSingleStudentId(e.target.value)}
                required
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effort Rating</label>
              <select value={effortRating} onChange={e => setEffortRating(Number(e.target.value))} className="w-full border rounded px-3 py-2 text-sm">
                {ratingOptions.map(v => <option key={v} value={v}>{v} — {['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'][v]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Participation Rating</label>
              <select value={participationRating} onChange={e => setParticipationRating(Number(e.target.value))} className="w-full border rounded px-3 py-2 text-sm">
                {ratingOptions.map(v => <option key={v} value={v}>{v} — {['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'][v]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Submitting...' : isEdit ? 'Update' : 'Submit'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session ID</label>
              <input
                type="text"
                value={singleSessionId}
                onChange={e => setSingleSessionId(e.target.value)}
                required
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID (to load roster)</label>
              <input
                type="text"
                value={batchId}
                onChange={e => setBatchId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Enter batch ID to load students"
              />
            </div>
          </div>

          {students.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Student</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Effort</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Participation</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((s, i) => (
                    <tr key={s.studentId}>
                      <td className="px-4 py-2 text-sm">{s.studentName}</td>
                      <td className="px-4 py-2">
                        <select value={s.effortRating} onChange={e => updateStudentField(i, 'effortRating', Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
                          {ratingOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select value={s.participationRating} onChange={e => updateStudentField(i, 'participationRating', Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
                          {ratingOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={s.comments}
                          onChange={e => updateStudentField(i, 'comments', e.target.value)}
                          className="border rounded px-2 py-1 text-sm w-full"
                          maxLength={2000}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button type="submit" disabled={loading || students.length === 0} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Submitting...' : `Submit Feedback for ${students.length} Students`}
          </button>
        </form>
      )}
    </div>
  );
}
