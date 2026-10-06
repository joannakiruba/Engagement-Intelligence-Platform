import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFeedback, type Feedback } from '../../services/feedback.service';

export function FeedbackDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getFeedback(id)
      .then((res: any) => setRecord(res?.data ?? res))
      .catch(() => setError('Failed to load feedback record.'))
      .finally(() => setLoading(false));
  }, [id]);

  function ratingDisplay(label: string, value: number) {
    const labels = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'];
    const colors = ['', 'text-red-600', 'text-orange-600', 'text-yellow-600', 'text-blue-600', 'text-green-600'];
    return (
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-lg font-semibold ${colors[value] || 'text-gray-900'}`}>
          {value}/5 — {labels[value] || 'N/A'}
        </p>
      </div>
    );
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!record) return <p className="text-gray-500">Record not found.</p>;

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feedback Details</h1>
        <Link to="/feedback" className="text-sm text-blue-600 hover:underline">
          &larr; Back to list
        </Link>
      </div>

      <div className="bg-white border rounded p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-500">Student</p>
          <p className="font-medium text-gray-900">{record.student?.name ?? record.studentId}</p>
          {record.student?.email && (
            <p className="text-xs text-gray-400">{record.student.email}</p>
          )}
        </div>

        <div>
          <p className="text-sm text-gray-500">Session</p>
          <p className="font-medium text-gray-900">{record.session?.title ?? record.sessionId}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Trainer</p>
          <p className="font-medium text-gray-900">{record.trainer?.name ?? record.trainerId}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          {ratingDisplay('Effort', record.effortRating)}
          {ratingDisplay('Participation', record.participationRating)}
        </div>

        {record.comments && (
          <div className="pt-2 border-t">
            <p className="text-sm text-gray-500">Comments</p>
            <p className="mt-1 text-gray-800 whitespace-pre-line">{record.comments}</p>
          </div>
        )}

        <div className="pt-2 border-t text-xs text-gray-400">
          Created: {new Date(record.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
export default FeedbackDetail;
