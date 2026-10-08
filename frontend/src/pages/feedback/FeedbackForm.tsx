import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createBulkFeedback, createFeedback, getFeedback, updateFeedback } from '../../services/feedback.service';
import { getBatches, getRoster, getSessions } from '../../services/batches.service';

interface StudentRow {
  studentId: string;
  studentName: string;
  effortRating: number;
  participationRating: number;
  comments: string;
}

export function FeedbackForm() {
  const { id, sessionId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [singleSessionId, setSingleSessionId] = useState(sessionId || '');
  const [singleStudentId, setSingleStudentId] = useState('');
  const [effortRating, setEffortRating] = useState(3);
  const [participationRating, setParticipationRating] = useState(3);
  const [comments, setComments] = useState('');

  const [isBulk, setIsBulk] = useState(!isEdit);
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkSessionId, setBulkSessionId] = useState('');
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [bulkResult, setBulkResult] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) getBatches().then(setBatches).catch(() => setBatches([]));
  }, [isEdit]);

  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      getFeedback(id)
        .then((f) => {
          setSingleSessionId(f.sessionId);
          setSingleStudentId(f.studentId);
          setEffortRating(f.effortRating);
          setParticipationRating(f.participationRating);
          setComments(f.comments || '');
        })
        .catch(() => setError('Failed to load feedback.'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  useEffect(() => {
    setBulkSessionId('');
    setSessions([]);
    setStudents([]);
    if (bulkBatchId) {
      getSessions(bulkBatchId).then(setSessions).catch(() => setSessions([]));
      getRoster(bulkBatchId)
        .then((roster: any[]) => {
          setStudents(
            roster.map((s) => ({
              studentId: s.id,
              studentName: s.name,
              effortRating: 3,
              participationRating: 3,
              comments: '',
            }))
          );
        })
        .catch(() => setStudents([]));
    }
  }, [bulkBatchId]);

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit && id) {
        await updateFeedback(id, { effortRating, participationRating, comments });
      } else {
        await createFeedback({
          sessionId: singleSessionId,
          studentId: singleStudentId,
          effortRating,
          participationRating,
          comments: comments || undefined,
        });
      }
      navigate('/feedback');
    } catch {
      setError('Failed to save feedback.');
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkSessionId) {
      setError('Please select a session.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await createBulkFeedback(bulkSessionId, students.map((row) => ({
        studentId: row.studentId,
        effortRating: row.effortRating,
        participationRating: row.participationRating,
        comments: row.comments || undefined,
      })));
      setBulkResult(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save bulk feedback.');
    } finally {
      setSaving(false);
    }
  }

  function updateStudentRow(index: number, field: keyof StudentRow, value: any) {
    setStudents((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Feedback' : 'Give Feedback'}
        </h1>
        {!isEdit && (
          <button
            type="button"
            onClick={() => setIsBulk(!isBulk)}
            className="text-sm text-blue-600 hover:underline"
          >
            {isBulk ? 'Switch to Single Entry' : 'Switch to Bulk (Batch) Entry'}
          </button>
        )}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {!isBulk ? (
        <form onSubmit={handleSingleSubmit} className="space-y-4">
          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Session ID</label>
                <input
                  type="text"
                  required
                  value={singleSessionId}
                  onChange={(e) => setSingleSessionId(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-2 text-sm"
                  placeholder="Session UUID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Student ID</label>
                <input
                  type="text"
                  required
                  value={singleStudentId}
                  onChange={(e) => setSingleStudentId(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-2 text-sm"
                  placeholder="Student UUID"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Effort Rating (1-5): {effortRating}
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={effortRating}
              onChange={(e) => setEffortRating(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Performance Rating (1-5): {participationRating}
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={participationRating}
              onChange={(e) => setParticipationRating(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Comments</label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm"
              placeholder="Optional constructive comments..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/feedback')}
              className="border px-4 py-2 rounded text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Batch</label>
            <select required value={bulkBatchId} onChange={(e) => setBulkBatchId(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2 text-sm">
              <option value="">Select a batch</option>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            </select>
          </div>

          {bulkBatchId && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Session</label>
              <select
                required
                value={bulkSessionId}
                onChange={(e) => setBulkSessionId(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select a session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {students.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">Students ({students.length})</h3>
              {students.map((st, i) => (
                <div key={st.studentId} className="p-3 border rounded bg-white space-y-2">
                  <span className="font-medium text-sm">{st.studentName}</span>
                  <div className="flex gap-4">
                    <label className="text-xs text-gray-600">
                      Effort:
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={st.effortRating}
                        onChange={(e) => updateStudentRow(i, 'effortRating', Number(e.target.value))}
                        className="ml-1 border rounded w-14 px-1 py-0.5 text-xs"
                      />
                    </label>
                    <label className="text-xs text-gray-600">
                      Performance:
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={st.participationRating}
                        onChange={(e) => updateStudentRow(i, 'participationRating', Number(e.target.value))}
                        className="ml-1 border rounded w-14 px-1 py-0.5 text-xs"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Comments..."
                    value={st.comments}
                    onChange={(e) => updateStudentRow(i, 'comments', e.target.value)}
                    className="w-full border rounded px-2 py-1 text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || students.length === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving All...' : 'Submit Bulk Feedback'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/feedback')}
              className="border px-4 py-2 rounded text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {bulkResult && (
        <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Saved feedback for {bulkResult.created ?? 0} students; skipped {bulkResult.skipped?.length ?? 0}.
          {bulkResult.skipped?.length > 0 && <ul className="mt-2 list-disc pl-5">{bulkResult.skipped.map((item: any) => <li key={item.studentId}>{item.studentId}: {item.reason}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
export default FeedbackForm;
