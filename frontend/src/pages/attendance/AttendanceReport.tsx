import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBatchAttendanceStats, exportBatchExcel } from '../../services/attendance.service';

interface StudentStat {
  student: {
    id: string;
    name: string;
    email: string;
  };
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendanceRate: number;
}

interface BatchStats {
  batch?: { id: string; name: string };
  batchId?: string;
  totalSessions: number;
  overallAttendanceRate: number;
  students?: StudentStat[];
}

export function AttendanceReport() {
  const { batchId } = useParams<{ batchId: string }>();
  const [data, setData] = useState<BatchStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!batchId) return;
    loadData();
  }, [batchId]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await getBatchAttendanceStats(batchId!);
      const parsed = res?.data ?? res;
      setData(parsed);
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  async function handleExportExcel() {
    if (!batchId) return;
    try {
      const params: { from?: string; to?: string } = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const blob = await exportBatchExcel(batchId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${batchId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export Excel');
    }
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Loading attendance report...</div>;
  }

  if (!data) {
    return <div className="text-center py-10 text-red-500">Failed to load batch attendance.</div>;
  }

  let filteredStudents = data.students || [];
  if (statusFilter !== 'ALL') {
    if (statusFilter === 'LOW') {
      filteredStudents = filteredStudents.filter((s) => s.attendanceRate < 75);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance Report</h1>
          <p className="text-gray-500 text-sm">{data.batch?.name || data.batchId || 'Batch Overview'}</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          Download Excel
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <p className="text-2xl font-bold text-slate-800">{data.totalSessions ?? 0}</p>
          <p className="text-xs text-slate-500">Total Sessions Tracked</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <p className="text-2xl font-bold text-indigo-600">
            {(data.overallAttendanceRate ?? 0).toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500">Overall Attendance Rate</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4 items-center bg-white p-3 rounded-xl border border-slate-200">
        <div>
          <label className="text-xs text-slate-500 block">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block">Filter</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-xs"
          >
            <option value="ALL">All Students</option>
            <option value="LOW">Below 75% (&lt;75%)</option>
          </select>
        </div>
      </div>

      {/* Student stats table */}
      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Student</th>
              <th className="px-4 py-2 text-center">Total</th>
              <th className="px-4 py-2 text-center">Present</th>
              <th className="px-4 py-2 text-center">Late</th>
              <th className="px-4 py-2 text-center">Absent</th>
              <th className="px-4 py-2 text-center">Excused</th>
              <th className="px-4 py-2 text-center">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No student records match the filter.
                </td>
              </tr>
            ) : (
              filteredStudents.map((s) => (
                <tr key={s.student.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-800">{s.student.name}</p>
                    <p className="text-xs text-slate-400">{s.student.email}</p>
                  </td>
                  <td className="px-4 py-2 text-center">{s.total}</td>
                  <td className="px-4 py-2 text-center text-emerald-600">{s.present}</td>
                  <td className="px-4 py-2 text-center text-amber-600">{s.late}</td>
                  <td className="px-4 py-2 text-center text-rose-600">{s.absent}</td>
                  <td className="px-4 py-2 text-center text-blue-600">{s.excused}</td>
                  <td className="px-4 py-2 text-center font-bold">
                    <span
                      className={
                        s.attendanceRate >= 75
                          ? 'text-emerald-600'
                          : 'text-rose-600 font-extrabold'
                      }
                    >
                      {s.attendanceRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default AttendanceReport;
