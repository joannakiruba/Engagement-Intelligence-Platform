import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBatches, getSessions } from '../../services/batches.service';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

interface Session {
  id: string;
  title: string;
  topic?: string | null;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  trainer?: { id: string; name: string; email: string };
  batchId?: string;
  batchName?: string;
}

interface BatchWithSessions {
  id: string;
  name: string;
  department?: string;
  sessions: Session[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AttendanceOverview() {
  const { hasPermission } = useAuth();
  const canCreateSession = hasPermission('sessions:create:batch');

  const [batchesWithSessions, setBatchesWithSessions] = useState<BatchWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBatchesAndSessions();
  }, []);

  async function loadBatchesAndSessions() {
    setLoading(true);
    setError('');
    try {
      const batchesRes: any = await getBatches();
      const batches = Array.isArray(batchesRes) ? batchesRes : batchesRes?.data ?? [];

      const batchesWithSessionsData = await Promise.all(
        batches.map(async (batch: any) => {
          try {
            const sessionsRes: any = await getSessions(batch.id);
            const sessions = Array.isArray(sessionsRes) ? sessionsRes : sessionsRes?.data ?? [];
            return {
              id: batch.id,
              name: batch.name,
              department: batch.department,
              sessions: sessions.map((s: any) => ({ ...s, batchId: batch.id, batchName: batch.name })),
            };
          } catch {
            return {
              id: batch.id,
              name: batch.name,
              department: batch.department,
              sessions: [],
            };
          }
        })
      );

      setBatchesWithSessions(batchesWithSessionsData);
    } catch (err) {
      setError('Failed to load batches and sessions');
    }
    setLoading(false);
  }

  if (loading) return <LoadingState message="Loading attendance overview..." />;
  if (error) return <ErrorState message={error} />;

  const allSessions = batchesWithSessions.flatMap((b) => b.sessions);
  const upcomingSessions = allSessions
    .filter((s) => new Date(s.scheduledDate) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const pastSessions = allSessions
    .filter((s) => new Date(s.scheduledDate) < new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  if (allSessions.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Attendance Overview</h1>
        </div>
        <EmptyState
          title="No Sessions Found"
          description="There are no scheduled sessions in your batches yet."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Overview</h1>
          <p className="text-slate-500 text-sm mt-1">View and manage attendance for all scheduled sessions</p>
        </div>
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Upcoming Sessions ({upcomingSessions.length})</h2>
          <div className="bg-white border rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Session Title</th>
                    <th className="text-left px-4 py-3 font-semibold">Batch</th>
                    <th className="text-left px-4 py-3 font-semibold">Topic</th>
                    <th className="text-left px-4 py-3 font-semibold">Trainer</th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upcomingSessions.map((session) => {
                    const date = new Date(session.scheduledDate);
                    return (
                      <tr key={session.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{date.toLocaleDateString()}</div>
                          <div className="text-xs text-slate-500">{DAY_NAMES[date.getDay()]}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{session.title}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <Link
                            to={`/batches/${session.batchId}`}
                            className="text-indigo-600 hover:underline text-xs font-medium"
                          >
                            {session.batchName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{session.topic || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{session.trainer?.name || '—'}</td>
                        <td className="px-4 py-3 text-right space-x-3">
                          <Link
                            to={`/attendance/session/${session.id}`}
                            className="text-xs font-medium text-indigo-600 hover:underline"
                          >
                            View Attendance
                          </Link>
                          {canCreateSession && (
                            <Link
                              to={`/attendance/mark/${session.id}`}
                              className="text-xs font-medium text-emerald-600 hover:underline"
                            >
                              Mark
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Past Sessions */}
      {pastSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Past Sessions ({pastSessions.length})</h2>
          <div className="bg-white border rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Session Title</th>
                    <th className="text-left px-4 py-3 font-semibold">Batch</th>
                    <th className="text-left px-4 py-3 font-semibold">Topic</th>
                    <th className="text-left px-4 py-3 font-semibold">Trainer</th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pastSessions.slice(0, 20).map((session) => {
                    const date = new Date(session.scheduledDate);
                    return (
                      <tr key={session.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-600">{date.toLocaleDateString()}</div>
                          <div className="text-xs text-slate-400">{DAY_NAMES[date.getDay()]}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">{session.title}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <Link
                            to={`/batches/${session.batchId}`}
                            className="text-indigo-600 hover:underline text-xs font-medium"
                          >
                            {session.batchName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{session.topic || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{session.trainer?.name || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/attendance/session/${session.id}`}
                            className="text-xs font-medium text-indigo-600 hover:underline"
                          >
                            View Attendance
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pastSessions.length > 20 && (
              <div className="px-4 py-3 bg-slate-50 text-center text-xs text-slate-500">
                Showing 20 of {pastSessions.length} past sessions
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceOverview;
