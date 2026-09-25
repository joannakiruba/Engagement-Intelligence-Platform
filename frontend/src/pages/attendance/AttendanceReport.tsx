import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBatchAttendanceStats, exportBatchExcel } from '../../services/attendance.service';

const STATUS_CODE: Record<string, string> = {
  PRESENT: 'P',
  ABSENT: 'A',
  LATE: 'L',
  EXCUSED: 'E',
};

interface StudentStat {
  student: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    year: number | null;
  };
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendanceRate: number;
}

interface BatchStats {
  batch: { id: string; name: string };
  totalSessions: number;
  overallAttendanceRate: number;
  students: StudentStat[];
}

export default function AttendanceReport() {
  const { batchId } = useParams<{ batchId: string }>();
  const [data, setData] = useState<BatchStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!batchId) return;
    loadData();
  }, [batchId]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await getBatchAttendanceStats(batchId!);
      setData(res.data);
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
      const blob = await exportBatchExcel(batchId, params);
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
    return <div className="text-center py-10 text-gray-500">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-10 text-red-500">Failed to load batch attendance.</div>;
  }

  const departments = [...new Set(data.students.map((s) => s.student.department).filter(Boolean))] as string[];
  const years = [...new Set(data.students.map((s) => s.student.year).filter((y) => y != null))] as number[];

  let filteredStudents = data.students;

  if (departmentFilter !== 'ALL') {
    filteredStudents = filteredStudents.filter((s) => s.student.department === departmentFilter);
  }
  if (yearFilter !== 'ALL') {
    filteredStudents = filteredStudents.filter((s) => String(s.student.year) === yearFilter);
  }
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
          <p className="text-gray-500 text-sm">{data.batch.name}</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
        >
          Download Excel
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-2xl font-bold">{data.totalSessions}</div>
          <div className="text-xs text-gray-500">Total Sessions</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-2xl font-bold">{data.students.length}</div>
          <div className="text-xs text-gray-500">Total Students</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-2xl font-bold">{data.overallAttendanceRate}%</div>
          <div className="text-xs text-gray-500">Overall Rate</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
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
        {departments.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
        {years.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="ALL">All Years</option>
              {years.sort().map((y) => (
                <option key={y} value={String(y)}>Year {y}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Attendance</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="ALL">All Students</option>
            <option value="LOW">Below 75%</option>
          </select>
        </div>
      </div>

      {/* Students table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white shadow rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-600">
              <th className="px-4 py-3 w-8">#</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3 text-center">{STATUS_CODE.PRESENT}</th>
              <th className="px-4 py-3 text-center">{STATUS_CODE.LATE}</th>
              <th className="px-4 py-3 text-center">{STATUS_CODE.ABSENT}</th>
              <th className="px-4 py-3 text-center">{STATUS_CODE.EXCUSED}</th>
              <th className="px-4 py-3 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((s, idx) => {
              const rateColor = s.attendanceRate >= 75
                ? 'text-green-700'
                : s.attendanceRate >= 50
                ? 'text-yellow-700'
                : 'text-red-700';

              return (
                <tr key={s.student.id} className="border-t text-sm">
                  <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{s.student.name}</div>
                    <div className="text-xs text-gray-400">{s.student.email}</div>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{s.student.department || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{s.student.year || '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">{s.present}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">{s.late}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">{s.absent}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{s.excused}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`font-medium ${rateColor}`}>{s.total}</span>
                  </td>
                </tr>
              );
            })}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">No students match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
