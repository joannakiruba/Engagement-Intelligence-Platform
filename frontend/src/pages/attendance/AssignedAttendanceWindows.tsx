import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAssignedAttendanceWindows } from '../../services/attendance.service';
import { LoadingState } from '../../components/common/LoadingState';
import { QrCode, Calendar, Clock, Users, User, ExternalLink } from 'lucide-react';

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isWindowActive = (window: AssignedWindow) => {
    const now = new Date();
    const start = new Date(window.startTime);
    const end = new Date(window.endTime);
    return now >= start && now <= end;
  };

  if (loading) {
    return <LoadingState message="Loading assigned sessions..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Assigned Session QR</h1>
            <p className="text-teal-100 text-sm mt-1">
              Display live attendance QR codes for sessions in your mentees&apos; batches
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Empty State */}
      {windows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Assigned Sessions</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            No attendance windows are available for your assigned mentees&apos; batches yet.
            Check back when sessions are scheduled.
          </p>
        </div>
      ) : (
        <>
          {/* Session Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-900">{windows.length}</span> attendance window{windows.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Sessions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {windows.map((window) => {
              const isActive = isWindowActive(window);

              return (
                <div
                  key={window.id}
                  className={`bg-white rounded-xl border p-5 shadow-xs hover:shadow-md transition-all ${
                    isActive ? 'border-green-300 bg-green-50/30' : 'border-slate-200'
                  }`}
                >
                  {/* Active Badge */}
                  {isActive && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Active Now
                      </span>
                    </div>
                  )}

                  {/* Session Title */}
                  <h3 className="text-base font-bold text-slate-900 mb-3 line-clamp-2">
                    {window.session.title}
                  </h3>

                  {/* Session Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{formatDate(window.session.scheduledDate)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>{window.session.batch.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Trainer: {window.session.trainer.name}</span>
                    </div>
                  </div>

                  {/* Window Info */}
                  <div className={`rounded-lg p-3 mb-4 ${
                    isActive ? 'bg-green-100 border border-green-200' : 'bg-slate-50 border border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-1">{window.label}</p>
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatTime(window.startTime)} – {formatTime(window.endTime)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Link
                    to={`/attendance/qr-fullscreen/${window.id}`}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                      isActive
                        ? 'bg-teal-600 text-white hover:bg-teal-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    Display QR Code
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default AssignedAttendanceWindows;
