import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSessionAttendance, exportSessionCsv } from '../../services/attendance.service';

const STATUS_CODE: Record<string, string> = {
  PRESENT: 'P',
  ABSENT: 'A',
  LATE: 'L',
  EXCUSED: 'E',
  NOT_MARKED: '—',
};

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800',
  ABSENT: 'bg-red-100 text-red-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  EXCUSED: 'bg-blue-100 text-blue-800',
  NOT_MARKED: 'bg-gray-100 text-gray-500',
};

interface AttendanceRecord {
  id: string;
  status: string;
  checkInTime: string | null;
  remarks: string | null;
  student: { id: string; name: string; email: string; department: string | null; year: number | null };
}

interface WindowInfo {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
}

interface SessionData {
  session: { id: string; title: string; scheduledDate: string };
  windows: WindowInfo[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    unmarked: number;
  };
  records: AttendanceRecord[];
  unmarked: { studentId: string; student: { id: string; name: string; email: string; department: string | null; year: number | null } }[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SessionAttendance() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!sessionId) return;
    loadData();
  }, [sessionId]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await getSessionAttendance(sessionId!);
      setData(res.data);
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  async function handleExport() {
    if (!sessionId) return;
    try {
      const blob = await exportSessionCsv(sessionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${sessionId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export CSV');
    }
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-10 text-red-500">Failed to load session attendance.</div>;
  }

  const { summary } = data;
  const attendanceRate = summary.total > 0
    ? Math.round(((summary.present + summary.late) / summary.total) * 100)
    : 0;

  const scheduledDate = new Date(data.session.scheduledDate);
  const dayOfWeek = DAY_NAMES[scheduledDate.getDay()];

  const allStudents = [
    ...data.records.map((r) => ({ ...r, displayStatus: r.status })),
    ...data.unmarked.map((um) => ({
      id: '',
      status: 'NOT_MARKED',
      displayStatus: 'NOT_MARKED',
      checkInTime: null,
      remarks: null,
      student: um.student,
    })),
  ];

  const filteredStudents = statusFilter === 'ALL'
    ? allStudents
    : allStudents.filter((s) => s.status === statusFilter);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">{data.session.title}</h1>
          <p className="text-gray-500 text-sm">
            {scheduledDate.toLocaleDateString()} ({dayOfWeek})
          </p>
          <p className="text-gray-400 text-xs">Session ID: {data.session.id}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/attendance/mark/${sessionId}`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Edit Attendance
          </Link>
          <button
            onClick={handleExport}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Windows list */}
      {data.windows && data.windows.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Attendance Windows</h3>
          <div className="flex gap-2">
            {data.windows.map((w) => (
              <Link
                key={w.id}
                to={`/attendance/qr/${w.id}`}
                className="bg-white border rounded px-3 py-2 text-sm hover:bg-gray-50"
              >
                <div className="font-medium">{w.label}</div>
                <div className="text-xs text-gray-500">
                  {new Date(w.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(w.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-2xl font-bold">{summary.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="bg-green-50 p-4 rounded shadow text-center">
          <div className="text-2xl font-bold text-green-700">{summary.present}</div>
          <div className="text-xs text-green-600">Present</div>
        </div>
        <div className="bg-red-50 p-4 rounded shadow text-center">
          <div className="text-2xl font-bold text-red-700">{summary.absent}</div>
          <div className="text-xs text-red-600">Absent</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded shadow text-center">
          <div className="text-2xl font-bold text-yellow-700">{summary.late}</div>
          <div className="text-xs text-yellow-600">Late</div>
        </div>
        <div className="bg-blue-50 p-4 rounded shadow text-center">
          <div className="text-2xl font-bold text-blue-700">{summary.excused}</div>
          <div className="text-xs text-blue-600">Excused</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-2xl font-bold">{attendanceRate}%</div>
          <div className="text-xs text-gray-500">Rate</div>
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex gap-2">
        {['ALL', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-sm rounded border ${
              statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'
            }`}
          >
            {s === 'ALL' ? 'All' : STATUS_CODE[s]}
          </button>
        ))}
      </div>

      {/* Records table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white shadow rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-600">
              <th className="px-4 py-3 w-8">#</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Check-In Time</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((rec, idx) => (
              <tr key={rec.student.id + rec.status} className={`border-t text-sm ${rec.status === 'NOT_MARKED' ? 'bg-gray-50' : ''}`}>
                <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                <td className="px-4 py-2">
                  <div className={`font-medium ${rec.status === 'NOT_MARKED' ? 'text-gray-400' : ''}`}>{rec.student.name}</div>
                  <div className="text-xs text-gray-400">{rec.student.email}</div>
                </td>
                <td className="px-4 py-2 text-gray-500">{rec.student.department || '—'}</td>
                <td className="px-4 py-2 text-gray-500">{rec.student.year || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[rec.status] || 'bg-gray-100'}`}>
                    {STATUS_CODE[rec.status] || rec.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString() : '—'}
                </td>
                <td className="px-4 py-2 text-gray-500">{rec.remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
