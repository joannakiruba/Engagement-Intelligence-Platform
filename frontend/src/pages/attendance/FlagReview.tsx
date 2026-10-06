import { useEffect, useState } from 'react';
import {
  getAttendanceFlags,
  resolveAttendanceFlag,
  getAttendanceFlagStats,
  type AttendanceFlagItem,
} from '../../services/attendance.service';

const REASON_LABELS: Record<string, string> = {
  IP_MISMATCH: 'Network Mismatch',
  DEVICE_CONFLICT: 'Device Conflict',
  DEVICE_RESET: 'New Device',
  MANUAL: 'Manual Flag',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED_FRAUD: 'bg-red-100 text-red-800',
  DISMISSED: 'bg-green-100 text-green-800',
};

export default function FlagReview() {
  const [flags, setFlags] = useState<AttendanceFlagItem[]>([]);
  const [stats, setStats] = useState({ pending: 0, confirmed: 0, dismissed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      const [flagsRes, statsRes] = await Promise.all([
        getAttendanceFlags(params),
        getAttendanceFlagStats(),
      ]);
      setFlags(flagsRes.data);
      setStats(statsRes.data);
    } catch {
      setError('Failed to load flags.');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  async function handleResolve(flagId: string, status: 'CONFIRMED_FRAUD' | 'DISMISSED') {
    setResolvingId(flagId);
    setError('');
    setSuccess('');
    try {
      await resolveAttendanceFlag(flagId, status);
      setSuccess(status === 'CONFIRMED_FRAUD' ? 'Flag confirmed — student marked absent.' : 'Flag dismissed.');
      await loadData();
    } catch {
      setError('Failed to resolve flag.');
    }
    setResolvingId(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Attendance Flag Review</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-500">Pending</div>
        </div>
        <div className="bg-white border rounded p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.confirmed}</div>
          <div className="text-sm text-gray-500">Confirmed Fraud</div>
        </div>
        <div className="bg-white border rounded p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.dismissed}</div>
          <div className="text-sm text-gray-500">Dismissed</div>
        </div>
        <div className="bg-white border rounded p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {success && <p className="text-green-600 mb-4">{success}</p>}

      {/* Filter */}
      <div className="flex gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED_FRAUD">Confirmed Fraud</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : flags.length === 0 ? (
        <div className="bg-white border rounded p-8 text-center text-gray-500">
          No flags found for the selected filter.
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => (
            <div key={flag.id} className="bg-white border rounded p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900">{flag.student.name}</p>
                  <p className="text-sm text-gray-500">{flag.student.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[flag.status] || 'bg-gray-100 text-gray-800'}`}>
                    {flag.status.replace('_', ' ')}
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {REASON_LABELS[flag.reason] || flag.reason}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <p className="text-gray-500">Session</p>
                  <p className="font-medium">{flag.attendance.session.title}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(flag.attendance.session.scheduledDate).toLocaleDateString()} — {flag.attendance.window.label}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Network Details</p>
                  <p className="text-xs font-mono">
                    Trainer: {flag.attendance.window.trainerIp || flag.attendance.window.networkFingerprint || 'N/A'}
                  </p>
                  <p className="text-xs font-mono">
                    Student: {flag.attendance.studentIp || flag.attendance.networkFingerprint || 'N/A'}
                  </p>
                </div>
              </div>

              {flag.details && (
                <div className="bg-gray-50 border rounded px-3 py-2 text-sm text-gray-600 mb-3">
                  {flag.details}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Flagged {new Date(flag.createdAt).toLocaleString()}</span>
                {flag.reviewer && (
                  <span>Reviewed by {flag.reviewer.name} on {flag.resolvedAt ? new Date(flag.resolvedAt).toLocaleString() : '—'}</span>
                )}
              </div>

              {flag.status === 'PENDING' && (
                <div className="flex gap-2 mt-3 border-t pt-3">
                  <button
                    onClick={() => handleResolve(flag.id, 'CONFIRMED_FRAUD')}
                    disabled={resolvingId === flag.id}
                    className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm Fraud
                  </button>
                  <button
                    onClick={() => handleResolve(flag.id, 'DISMISSED')}
                    disabled={resolvingId === flag.id}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
