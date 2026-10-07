import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeedbackList, deleteFeedback, type Feedback } from '../../services/feedback.service';
import { useAuth } from '../../context/AuthContext';

export function FeedbackList() {
  const { user } = useAuth();
  const isTrainer = user?.role === 'TRAINER';
  const [records, setRecords] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');

  async function load() {
    try {
      setLoading(true);
      const filters: Record<string, string> = {};
      if (sessionFilter) filters.sessionId = sessionFilter;
      if (studentFilter) filters.studentId = studentFilter;
      const data = await getFeedbackList(filters);
      setRecords(data || []);
      setError('');
    } catch {
      setError('Failed to load feedback records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this feedback record?')) return;
    try {
      await deleteFeedback(id);
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch {
      setError('Failed to delete record.');
    }
  }

  function ratingBadge(value: number) {
    const colors = ['', 'bg-red-100 text-red-800', 'bg-orange-100 text-orange-800', 'bg-yellow-100 text-yellow-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800'];
    return <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${colors[value] || 'bg-gray-100 text-gray-800'}`}>{value}/5</span>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Trainer Feedback</h1>
        {isTrainer && (
          <Link
            to="/feedback/new"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + Give Feedback
          </Link>
        )}
      </div>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Filter by Session ID"
          value={sessionFilter}
          onChange={e => setSessionFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-80"
        />
        <input
          type="text"
          placeholder="Filter by Student ID"
          value={studentFilter}
          onChange={e => setStudentFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-80"
        />
        <button onClick={load} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
          Apply
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : records.length === 0 ? (
        <p className="text-gray-500">No feedback records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Student</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Session</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Trainer</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Effort</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Participation</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Date</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{r.student?.name ?? r.studentId}</td>
                  <td className="px-4 py-2 text-sm">{r.session?.title ?? r.sessionId}</td>
                  <td className="px-4 py-2 text-sm">{r.trainer?.name ?? r.trainerId}</td>
                  <td className="px-4 py-2 text-sm">{ratingBadge(r.effortRating)}</td>
                  <td className="px-4 py-2 text-sm">{ratingBadge(r.participationRating)}</td>
                  <td className="px-4 py-2 text-sm">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-sm flex gap-2">
                    <Link to={`/feedback/${r.id}`} className="text-blue-600 hover:underline">View</Link>
                    {isTrainer && (
                      <>
                        <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default FeedbackList;
