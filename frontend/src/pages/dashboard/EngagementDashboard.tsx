import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getEngagementDashboard,
  type DashboardData,
  type DateFilters,
} from '../../services/dashboard.service';

export default function EngagementDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const filters: DateFilters = {};
      if (fromDate) filters.from = fromDate;
      if (toDate) filters.to = toDate;
      const result = await getEngagementDashboard(filters);
      setData(result);
    } catch {
      setError('Failed to load engagement dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === 'student') return;
    load();
  }, []);

  if (user?.role === 'student') {
    return <Navigate to={`/dashboard/student/${user.id}`} replace />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Engagement Dashboard</h1>

      <div className="flex flex-wrap gap-3 mb-6 items-end">
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

      {error && (
        <div className="mb-4">
          <p className="text-red-600">{error}</p>
          <button onClick={load} className="text-sm text-blue-600 hover:underline mt-1">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !data ? null : data.batches.length === 0 ? (
        <p className="text-gray-500">No engagement data available.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-white p-4 rounded shadow text-center">
              <div className="text-2xl font-bold">{data.totalStudents}</div>
              <div className="text-xs text-gray-500">Total Students</div>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <div className="text-2xl font-bold">{data.totalBatches}</div>
              <div className="text-xs text-gray-500">Total Batches</div>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <div className="text-2xl font-bold">{data.totalSessions}</div>
              <div className="text-xs text-gray-500">Total Sessions</div>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <div className="text-2xl font-bold">{data.averageAttendanceRate}%</div>
              <div className="text-xs text-gray-500">Avg Attendance Rate</div>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <div className="text-2xl font-bold">{data.averageAssessmentScore}%</div>
              <div className="text-xs text-gray-500">Avg Assessment Score</div>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <div className="text-2xl font-bold">{data.averageEffortRating}/5</div>
              <div className="text-xs text-gray-500">Avg Effort Rating</div>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <div className="text-2xl font-bold">{data.averageParticipationRating}/5</div>
              <div className="text-xs text-gray-500">Avg Participation Rating</div>
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-3">Batch Engagement</h2>

          <div className="overflow-x-auto">
            <table className="w-full bg-white border rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Batch Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Students</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Attendance Rate</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Assessment Avg</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Effort</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Participation</th>
                </tr>
              </thead>
              <tbody>
                {data.batches.map((b) => (
                  <tr key={b.batchId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link to={`/dashboard/batch/${b.batchId}`} className="text-blue-600 hover:underline">
                        {b.batchName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">{b.studentCount}</td>
                    <td className="px-4 py-3 text-sm">{b.attendanceRate}%</td>
                    <td className="px-4 py-3 text-sm">{b.averageAssessmentScore}%</td>
                    <td className="px-4 py-3 text-sm">{b.averageEffortRating}/5</td>
                    <td className="px-4 py-3 text-sm">{b.averageParticipationRating}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
