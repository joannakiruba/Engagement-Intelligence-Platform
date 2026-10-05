import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  getStudentEngagement,
  type StudentEngagementData,
  type StudentFilters,
} from '../../services/dashboard.service';

export default function StudentEngagement() {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const batchIdParam = searchParams.get('batchId') || '';

  const [data, setData] = useState<StudentEngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [batchId, setBatchId] = useState(batchIdParam);

  async function load() {
    if (!studentId) return;
    setLoading(true);
    setError('');
    try {
      const filters: StudentFilters = {};
      if (batchId) filters.batchId = batchId;
      if (fromDate) filters.from = fromDate;
      if (toDate) filters.to = toDate;
      const result = await getStudentEngagement(studentId, filters);
      setData(result);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 404 ? 'Student not found.' : 'Failed to load student engagement.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [studentId]);

  const backLink = batchIdParam ? `/dashboard/batch/${batchIdParam}` : '/dashboard';
  const backLabel = batchIdParam ? 'Back to Batch' : 'Back to Dashboard';

  if (loading) return <p className="text-gray-500">Loading...</p>;

  if (error) {
    return (
      <div>
        <p className="text-red-600">{error}</p>
        <button onClick={load} className="text-sm text-blue-600 hover:underline mt-1">
          Retry
        </button>
        <div className="mt-2">
          <Link to={backLink} className="text-sm text-gray-500 hover:underline">
            &larr; {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <Link to={backLink} className="text-sm text-gray-500 hover:underline">
        &larr; {backLabel}
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold">{data.student.name}</h1>
        <p className="text-sm text-gray-500">
          {data.student.email}
          {data.student.department && <span> &middot; {data.student.department}</span>}
          {data.student.year != null && <span> &middot; Year {data.student.year}</span>}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Batch ID</label>
          <input
            type="text"
            placeholder="Filter by batch"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm w-64"
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
        <button
          onClick={load}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Apply
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">Attendance</h2>
        <div className="text-2xl font-bold mb-2">{data.attendance.attendanceRate}%</div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
            {data.attendance.presentCount} present
          </span>
          <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">
            {data.attendance.lateCount} late
          </span>
          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">
            {data.attendance.absentCount} absent
          </span>
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
            {data.attendance.excusedCount} excused
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">{data.attendance.totalRecords} total records</div>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">Assessments</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-2xl font-bold">{data.assessments.averagePercentage}%</div>
            <div className="text-xs text-gray-500">Average Percentage</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{data.assessments.totalAssessments}</div>
            <div className="text-xs text-gray-500">Total Assessments</div>
          </div>
        </div>

        {data.assessments.results.length === 0 ? (
          <p className="text-gray-500 text-sm">No assessment results.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Score</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Max Score</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Percentage</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.assessments.results.map((r) => (
                  <tr key={r.assessmentId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">{r.title}</td>
                    <td className="px-4 py-2 text-sm">{r.type}</td>
                    <td className="px-4 py-2 text-sm">{r.score}</td>
                    <td className="px-4 py-2 text-sm">{r.maxScore}</td>
                    <td className="px-4 py-2 text-sm">{r.percentage}%</td>
                    <td className="px-4 py-2 text-sm">
                      {new Date(r.assessmentDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">Feedback</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <div className="text-2xl font-bold">{data.feedback.totalFeedback}</div>
            <div className="text-xs text-gray-500">Total Feedback</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{data.feedback.averageEffortRating}/5</div>
            <div className="text-xs text-gray-500">Avg Effort</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{data.feedback.averageParticipationRating}/5</div>
            <div className="text-xs text-gray-500">Avg Participation</div>
          </div>
        </div>

        {data.feedback.recentFeedback.length === 0 ? (
          <p className="text-gray-500 text-sm">No feedback records.</p>
        ) : (
          <>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Feedback</h3>
            <div className="space-y-3">
              {data.feedback.recentFeedback.map((f, i) => (
                <div key={i} className="border rounded p-3">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium">{f.sessionTitle}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-3 text-sm mb-1">
                    <span>Effort: {f.effortRating}/5</span>
                    <span>Participation: {f.participationRating}/5</span>
                  </div>
                  {f.comments && (
                    <p className="text-sm text-gray-600 mt-1">{f.comments}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
