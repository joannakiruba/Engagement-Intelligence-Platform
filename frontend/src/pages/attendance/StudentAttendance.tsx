import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getStudentAttendance } from '../../services/attendance.service';
import { useAuth } from '../../context/AuthContext';

const STATUS_CODE: Record<string, string> = {
  PRESENT: 'P',
  ABSENT: 'A',
  LATE: 'L',
  EXCUSED: 'E',
};

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800',
  ABSENT: 'bg-rose-100 text-rose-800',
  LATE: 'bg-amber-100 text-amber-800',
  EXCUSED: 'bg-blue-100 text-blue-800',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface StudentRecord {
  id: string;
  status: string;
  checkInTime: string | null;
  remarks: string | null;
  session?: {
    id: string;
    title: string;
    scheduledDate: string;
    batch?: { id: string; name: string };
  };
  window?: {
    id: string;
    label: string;
    startTime: string;
    endTime: string;
  };
}

interface StudentData {
  student?: { id: string; name: string; email: string };
  studentId?: string;
  attendanceRate?: number;
  total?: number;
  present?: number;
  late?: number;
  absent?: number;
  excused?: number;
  summary?: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendanceRate: number;
  };
  records?: StudentRecord[];
  history?: StudentRecord[];
}

export function StudentAttendance() {
  const { studentId: routeStudentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const studentId = routeStudentId || user?.id || 'std-001';

  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [batchId, setBatchId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (!studentId) return;
    loadData();
  }, [studentId]);

  async function loadData() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (batchId) params.batchId = batchId;
      if (sessionId) params.sessionId = sessionId;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res: any = await getStudentAttendance(studentId, params);
      const parsed = res?.data ?? res;
      setData(parsed);
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
    return <div className="text-center py-10 text-gray-500">Loading student attendance...</div>;
  }

  if (!data) {
    return <div className="text-center py-10 text-rose-500">Failed to load student attendance.</div>;
  }

  const student = data.student || { id: studentId, name: user?.name || 'Student', email: user?.email || '' };
  const summary = data.summary || {
    total: data.total ?? 0,
    present: data.present ?? 0,
    late: data.late ?? 0,
    absent: data.absent ?? 0,
    excused: data.excused ?? 0,
    attendanceRate: data.attendanceRate ?? 0,
  };
  const records = data.records || data.history || [];

  const rateColor = summary.attendanceRate >= 75
    ? 'text-emerald-700'
    : summary.attendanceRate >= 50
    ? 'text-amber-700'
    : 'text-rose-700';

  return (
    <div>
      {/* Student header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
        <p className="text-slate-500 text-sm">{student.email}</p>
        <p className="text-slate-400 text-xs">ID: {student.id}</p>
      </div>

      {/* Attendance rate card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 flex flex-wrap items-center gap-8 shadow-xs">
        <div className="text-center">
          <div className={`text-4xl font-extrabold ${rateColor}`}>{summary.attendanceRate}%</div>
          <div className="text-xs text-slate-500 mt-1 uppercase font-semibold">Attendance Rate</div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-800">{summary.total}</div>
            <div className="text-slate-500 text-xs">Total</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-emerald-600">{summary.present}</div>
            <div className="text-slate-500 text-xs">Present</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-amber-600">{summary.late}</div>
            <div className="text-slate-500 text-xs">Late</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-rose-600">{summary.absent}</div>
            <div className="text-slate-500 text-xs">Absent</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">{summary.excused}</div>
            <div className="text-slate-500 text-xs">Excused</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="flex flex-wrap gap-3 mb-4 items-end bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Batch ID</label>
          <input
            type="text"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="Filter by batch..."
            className="border border-slate-300 rounded px-3 py-1.5 text-sm w-48"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Session ID</label>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Filter by session..."
            className="border border-slate-300 rounded px-3 py-1.5 text-sm w-48"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          Apply
        </button>
      </form>

      {/* Session list */}
      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Check-In</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {records.map((rec) => {
              const date = rec.session?.scheduledDate ? new Date(rec.session.scheduledDate) : new Date();
              return (
                <tr key={rec.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{rec.session?.title || 'Session'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{date.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-slate-500">{DAY_NAMES[date.getDay()]}</td>
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
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No attendance records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default StudentAttendance;
