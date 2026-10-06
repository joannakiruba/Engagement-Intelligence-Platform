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
  session?: { id: string; title: string; scheduledDate: string };
  batch?: { id: string; name: string };
  windows?: WindowInfo[];
  stats?: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number;
  };
  summary?: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    unmarked: number;
  };
  records: AttendanceRecord[];
  unmarked?: { studentId: string; student: { id: string; name: string; email: string; department: string | null; year: number | null } }[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SessionAttendance() {
  const { id, sessionId: routeSessionId } = useParams<{ id?: string; sessionId?: string }>();
  const activeSessionId = id || routeSessionId || 'sess-001';
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!activeSessionId) {
      setLoading(false);
      return;
    }
    loadData();
  }, [activeSessionId]);

  async function loadData() {
    setLoading(true);
    try {
      const res: any = await getSessionAttendance(activeSessionId);
      const parsed = res?.data ?? res;
      setData(parsed);
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  async function handleExport() {
    if (!activeSessionId) return;
    try {
      const blob = await exportSessionCsv(activeSessionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-attendance-${activeSessionId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export CSV');
    }
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading session attendance...</div>;
  }

  if (!data) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600 mb-4">No session attendance data available.</p>
        <Link to="/batches" className="text-indigo-600 font-medium hover:underline">
          &larr; View Batches &amp; Sessions
        </Link>
      </div>
    );
  }

  const session = data.session || { id: activeSessionId, title: 'Session Details', scheduledDate: new Date().toISOString() };
  const date = new Date(session.scheduledDate);
  const summary = data.summary || {
    total: data.stats?.total ?? data.records?.length ?? 0,
    present: data.stats?.present ?? 0,
    absent: data.stats?.absent ?? 0,
    late: data.stats?.late ?? 0,
    excused: data.stats?.excused ?? 0,
    unmarked: 0,
  };
  const attendanceRate = data.stats?.rate ?? (summary.total > 0 ? Math.round(((summary.present + summary.late) / summary.total) * 100) : 0);

  const allStudents = [
    ...(data.records || []),
    ...(data.unmarked || []).map((u) => ({
      id: u.studentId,
      status: 'NOT_MARKED',
      checkInTime: null,
      remarks: null,
      student: u.student,
    })),
  ];

  const filteredStudents =
    statusFilter === 'ALL'
      ? allStudents
      : allStudents.filter((r) => r.status === statusFilter);

  return (
    <div>
      {/* Session header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{session.title}</h1>
          <p className="text-slate-500 text-sm">
            {DAY_NAMES[date.getDay()]}, {date.toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium border border-slate-200"
          >
            Export CSV
          </button>
          <Link
            to={`/attendance/mark`}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-xs"
          >
            Mark Attendance
          </Link>
        </div>
      </div>

      {/* Summary stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <div className="text-2xl font-bold text-slate-800">{summary.total}</div>
          <div className="text-xs text-slate-500">Total</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
          <div className="text-2xl font-bold text-emerald-700">{summary.present}</div>
          <div className="text-xs text-emerald-600">Present</div>
        </div>
        <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-center">
          <div className="text-2xl font-bold text-rose-700">{summary.absent}</div>
          <div className="text-xs text-rose-600">Absent</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
          <div className="text-2xl font-bold text-amber-700">{summary.late}</div>
          <div className="text-xs text-amber-600">Late</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
          <div className="text-2xl font-bold text-blue-700">{summary.excused}</div>
          <div className="text-xs text-blue-600">Excused</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <div className="text-2xl font-bold text-indigo-600">{attendanceRate}%</div>
          <div className="text-xs text-slate-500">Rate</div>
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex gap-2">
        {['ALL', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === 'ALL' ? 'All Records' : STATUS_CODE[s] + ' — ' + s}
          </button>
        ))}
      </div>

      {/* Records table */}
      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 w-8">#</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Check-In Time</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredStudents.map((rec, idx) => (
              <tr key={rec.id || (rec.student?.id || idx)} className={`hover:bg-slate-50 ${rec.status === 'NOT_MARKED' ? 'bg-slate-50/50' : ''}`}>
                <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
                <td className="px-4 py-2.5">
                  <div className={`font-medium ${rec.status === 'NOT_MARKED' ? 'text-slate-400' : 'text-slate-800'}`}>{rec.student?.name}</div>
                  <div className="text-xs text-slate-400">{rec.student?.email}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{rec.student?.department || '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{rec.student?.year || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[rec.status] || 'bg-slate-100 text-slate-700'}`}>
                    {rec.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{rec.remarks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default SessionAttendance;
