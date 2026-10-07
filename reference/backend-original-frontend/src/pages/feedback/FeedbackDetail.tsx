import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFeedback, type Feedback } from '../../services/feedback.service';

export default function FeedbackDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getFeedback(id)
      .then(setRecord)
      .catch(() => setError('Failed to load feedback record.'))
      .finally(() => setLoading(false));
  }, [id]);

  function ratingDisplay(label: string, value: number) {
    const labels = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'];
    const colors = ['', 'text-red-600', 'text-orange-600', 'text-yellow-600', 'text-blue-600', 'text-green-600'];
    return (
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-lg font-semibold ${colors[value]}`}>
          {value}/5 — {labels[value]}
        </p>
      </div>
    );
  }

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!record) return <p className="text-gray-500">Not found.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feedback Detail</h1>
        <div className="flex gap-3">
          <Link to={`/feedback/${record.id}/edit`} className="text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200">
            Edit
          </Link>
          <Link to="/feedback" className="text-sm text-gray-600 hover:underline">
            Back to list
          </Link>
        </div>
      </div>

      <div className="bg-white border rounded p-6 space-y-6 max-w-2xl">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Student</p>
            <p className="font-medium">{record.student?.name ?? record.studentId}</p>
            {record.student?.email && <p className="text-sm text-gray-400">{record.student.email}</p>}
          </div>
          <div>
            <p className="text-sm text-gray-500">Session</p>
            <p className="font-medium">{record.session?.title ?? record.sessionId}</p>
            {record.session?.scheduledDate && (
              <p className="text-sm text-gray-400">{new Date(record.session.scheduledDate).toLocaleDateString()}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">Trainer</p>
            <p className="font-medium">{record.trainer?.name ?? record.trainerId}</p>
            {record.trainer?.email && <p className="text-sm text-gray-400">{record.trainer.email}</p>}
          </div>
        </div>

        <hr />

        <div className="grid grid-cols-2 gap-6">
          {ratingDisplay('Effort Rating', record.effortRating)}
          {ratingDisplay('Participation Rating', record.participationRating)}
        </div>

        {record.comments && (
          <>
            <hr />
            <div>
              <p className="text-sm text-gray-500 mb-1">Comments</p>
              <p className="text-gray-800 whitespace-pre-wrap">{record.comments}</p>
            </div>
          </>
        )}

        <hr />
        <p className="text-sm text-gray-400">
          Submitted: {new Date(record.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
