import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAssignedAttendanceWindows } from '../../services/attendance.service';

interface AssignedWindow {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  session: {
    id: string;
    title: string;
    scheduledDate: string;
    batch: { name: string };
    trainer: { name: string };
  };
}

export function AssignedAttendanceWindows() {
  const [windows, setWindows] = useState<AssignedWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAssignedAttendanceWindows()
      .then(setWindows)
      .catch((err: any) => setError(err.response?.data?.error || 'Could not load assigned sessions.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Assigned Session QR</h1>
        <p className="mt-1 text-sm text-slate-500">Display the live attendance QR for sessions in your mentees&apos; batches.</p>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading ? <p className="text-slate-500">Loading sessions...</p> : windows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          No attendance windows are available for your assigned mentees&apos; batches yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Session</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Trainer</th><th className="px-4 py-3">Window</th><th className="px-4 py-3">QR</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {windows.map((window) => (
                <tr key={window.id}>
                  <td className="px-4 py-3"><div className="font-medium text-slate-900">{window.session.title}</div><div className="text-xs text-slate-500">{new Date(window.session.scheduledDate).toLocaleDateString()}</div></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{window.session.batch.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{window.session.trainer.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{window.label}<div className="text-xs text-slate-500">{new Date(window.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(window.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></td>
                  <td className="px-4 py-3"><Link to={`/attendance/qr-fullscreen/${window.id}`} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">Display QR</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AssignedAttendanceWindows;
