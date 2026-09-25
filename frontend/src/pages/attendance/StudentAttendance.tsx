import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getStudentAttendance } from '../../services/attendance.service';

const STATUS_CODE: Record<string, string> = {
  PRESENT: 'P',
  ABSENT: 'A',
  LATE: 'L',
  EXCUSED: 'E',
};

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800',
  ABSENT: 'bg-red-100 text-red-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  EXCUSED: 'bg-blue-100 text-blue-800',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface StudentRecord {
  id: string;
  status: string;
  checkInTime: string | null;
  remarks: string | null;
  session: {
    id: string;
    title: string;
    scheduledDate: string;
    batch: { id: string; name: string };
  };
  window: {
    id: string;
    label: string;
    startTime: string;
    endTime: string;
  };
}

interface StudentData {
  student: { id: string; name: string; email: string; department: string | null; year: number | null };
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendanceRate: number;
  };
  records: StudentRecord[];
}

export default function StudentAttendance() {
  const { studentId } = useParams<{ studentId: string }>();
  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [batchId, setBatchId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (!studentId) return;
    loadData();
  }, [studentId]);

  async function loadData() {
    setLoading(true);
    try {
      const params: { batchId?: string; from?: string; to?: string } = {};
      if (batchId) params.batchId = batchId;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await getStudentAttendance(studentId!, params);
      setData(res.data);
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    loadData();
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-10 text-red-500">Failed to load student attendance.</div>;
  }

  const { student, summary } = data;

  const rateColor = summary.attendanceRate >= 75
    ? 'text-green-700'
    : summary.attendanceRate >= 50
    ? 'text-yellow-700'
    : 'text-red-700';

  return (
    <div>
      {/* Student header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{student.name}</h1>
        <p className="text-gray-500 text-sm">{student.email}</p>
        {student.department && <p className="text-gray-400 text-sm">{student.department}{student.year ? ` — Year ${student.year}` : ''}</p>}
      </div>

      {/* Attendance rate card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 flex items-center gap-8">
        <div className="text-center">
          <div className={`text-4xl font-bold ${rateColor}`}>{summary.attendanceRate}%</div>
          <div className="text-sm text-gray-500 mt-1">Attendance Rate</div>
        </div>
        <div className="flex gap-6 text-sm">
          <div className="text-center">
            <div className="text-lg font-semibold">{summary.total}</div>
            <div className="text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-700">{summary.present}</div>
            <div className="text-gray-500">Present</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-yellow-700">{summary.late}</div>
            <div className="text-gray-500">Late</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-700">{summary.absent}</div>
            <div className="text-gray-500">Absent</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-700">{summary.excused}</div>
            <div className="text-gray-500">Excused</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="flex gap-3 mb-4 items-end">
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

      {/* Session list */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white shadow rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-600">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Check-In</th>
            </tr>
          </thead>
          <tbody>
            {data.records.map((rec) => {
              const date = new Date(rec.session.scheduledDate);
              return (
                <tr key={rec.id} className="border-t text-sm">
                  <td className="px-4 py-2">{date.toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-gray-500">{DAY_NAMES[date.getDay()]}</td>
                  <td className="px-4 py-2">{rec.session.title}</td>
                  <td className="px-4 py-2 text-gray-500">{rec.window.label}</td>
                  <td className="px-4 py-2 text-gray-500">{rec.session.batch.name}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[rec.status] || 'bg-gray-100'}`}>
                      {STATUS_CODE[rec.status] || rec.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              );
            })}
            {data.records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No attendance records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
