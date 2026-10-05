import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getBatchEngagement,
  getBatchTrends,
  type BatchEngagementData,
  type BatchTrendsData,
  type DateFilters,
} from '../../services/dashboard.service';

function BarChart({
  items,
  title,
  color,
  maxValue,
  unit,
}: {
  items: { label: string; value: number }[];
  title: string;
  color: string;
  maxValue: number;
  unit?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="bg-white p-4 rounded shadow">
        <h3 className="text-sm font-medium text-gray-700 mb-3">{title}</h3>
        <p className="text-gray-500">No trend data available.</p>
      </div>
    );
  }

  const W = 500;
  const H = 200;
  const padTop = 24;
  const padBot = 28;
  const chartH = H - padTop - padBot;
  const step = W / items.length;
  const barW = Math.min(36, step * 0.6);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-sm font-medium text-gray-700 mb-3">{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {items.map((item, i) => {
          const h = maxValue > 0 ? (item.value / maxValue) * chartH : 0;
          const x = step * i + (step - barW) / 2;
          const y = padTop + chartH - h;
          const label = item.label.length > 10 ? item.label.slice(0, 9) + '…' : item.label;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} fill={color} rx={2} />
              <text
                x={step * i + step / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="10"
                fill="#4b5563"
              >
                {item.value}{unit}
              </text>
              <text
                x={step * i + step / 2}
                y={padTop + chartH + 14}
                textAnchor="middle"
                fontSize="9"
                fill="#9ca3af"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function BatchEngagement() {
  const { batchId } = useParams<{ batchId: string }>();
  const [data, setData] = useState<BatchEngagementData | null>(null);
  const [trends, setTrends] = useState<BatchTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  async function load() {
    if (!batchId) return;
    setLoading(true);
    setError('');
    try {
      const filters: DateFilters = {};
      if (fromDate) filters.from = fromDate;
      if (toDate) filters.to = toDate;
      const [batchData, trendsData] = await Promise.all([
        getBatchEngagement(batchId, filters),
        getBatchTrends(batchId, filters),
      ]);
      setData(batchData);
      setTrends(trendsData);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 404 ? 'Batch not found.' : 'Failed to load batch engagement.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [batchId]);

  if (loading) return <p className="text-gray-500">Loading...</p>;

  if (error) {
    return (
      <div>
        <p className="text-red-600">{error}</p>
        <button onClick={load} className="text-sm text-blue-600 hover:underline mt-1">
          Retry
        </button>
        <div className="mt-2">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">
        &larr; Back to Dashboard
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold">{data.batch.name}</h1>
        <p className="text-sm text-gray-500">
          {data.batch.department && <span>{data.batch.department} &middot; </span>}
          Started {new Date(data.batch.startDate).toLocaleDateString()}
        </p>
      </div>

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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-2xl font-bold">{data.studentCount}</div>
          <div className="text-xs text-gray-500">Student Count</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-2xl font-bold">{data.sessionCount}</div>
          <div className="text-xs text-gray-500">Session Count</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-2xl font-bold">{data.assessmentCount}</div>
          <div className="text-xs text-gray-500">Assessment Count</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Attendance Summary</h3>
          <div className="text-2xl font-bold mb-1">{data.attendance.averageRate}%</div>
          <div className="text-xs text-gray-500 space-y-0.5">
            <div>{data.attendance.presentCount} present</div>
            <div>{data.attendance.lateCount} late</div>
            <div>{data.attendance.absentCount} absent</div>
            <div>{data.attendance.excusedCount} excused</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Assessment Summary</h3>
          <div className="text-2xl font-bold mb-1">{data.assessments.averagePercentage}%</div>
          <div className="text-xs text-gray-500">{data.assessments.totalResults} total results</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Feedback Summary</h3>
          <div className="text-sm space-y-1">
            <div>Avg Effort: <span className="font-semibold">{data.feedback.averageEffortRating}/5</span></div>
            <div>Avg Participation: <span className="font-semibold">{data.feedback.averageParticipationRating}/5</span></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">{data.feedback.totalFeedbackCount} records</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Student Engagement</h2>
      {data.students.length === 0 ? (
        <p className="text-gray-500 mb-6">No student engagement data available.</p>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full bg-white border rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Attendance Rate</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Assessment Avg</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Effort</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Participation</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.studentId} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link
                      to={`/dashboard/student/${s.studentId}?batchId=${batchId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {s.studentName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.studentEmail}</td>
                  <td className="px-4 py-3 text-sm">{s.attendanceRate}%</td>
                  <td className="px-4 py-3 text-sm">{s.assessmentAverage}%</td>
                  <td className="px-4 py-3 text-sm">{s.effortRating}/5</td>
                  <td className="px-4 py-3 text-sm">{s.participationRating}/5</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {trends && (
        <>
          <h2 className="text-lg font-semibold mb-3">Trends</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <BarChart
              title="Attendance Rate by Session"
              color="#3b82f6"
              maxValue={100}
              unit="%"
              items={trends.attendance.map((t) => ({
                label: t.sessionTitle,
                value: t.attendanceRate,
              }))}
            />
            <BarChart
              title="Assessment Average by Assessment"
              color="#22c55e"
              maxValue={100}
              unit="%"
              items={trends.assessments.map((t) => ({
                label: t.title,
                value: t.averagePercentage,
              }))}
            />
            <BarChart
              title="Feedback Ratings by Session"
              color="#8b5cf6"
              maxValue={5}
              unit=""
              items={trends.feedback.map((t) => ({
                label: t.sessionTitle,
                value: Math.round(((t.averageEffortRating + t.averageParticipationRating) / 2) * 10) / 10,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
