// Quick Attendance Access for Trainer Dashboard
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../services/api';
import {
  QrCode,
  CheckCircle,
  Calendar,
  Clock,
  Users,
  X,
  ExternalLink,
  Maximize2,
} from 'lucide-react';

interface AttendanceWindow {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  sessionId: string;
}

interface Session {
  id: string;
  title: string;
  topic: string | null;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  batchName?: string;
  attendanceWindows?: AttendanceWindow[];
}

export const QuickAttendanceCard: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWindow, setSelectedWindow] = useState<AttendanceWindow | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    loadUpcomingSessions();
  }, []);

  const loadUpcomingSessions = async () => {
    try {
      setLoading(true);

      // Get trainer's batches
      const batchesRes = await api.get('/api/batches');
      const batches = batchesRes.data?.data || batchesRes.data || [];

      // Get sessions from all batches
      const allSessions: Session[] = [];
      for (const batch of batches.slice(0, 10)) { // Limit to first 10 batches
        try {
          const sessionsRes = await api.get(`/api/batches/${batch.id}/sessions`);
          const batchSessions = sessionsRes.data?.data || sessionsRes.data || [];
          allSessions.push(...batchSessions.map((s: any) => ({
            ...s,
            batchName: batch.name
          })));
        } catch (error) {
          console.error(`Failed to load sessions for batch ${batch.id}:`, error);
        }
      }

      // Filter to today and future sessions
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const upcomingSessions = allSessions
        .filter(s => new Date(s.scheduledDate) >= today)
        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        .slice(0, 5);

      // Fetch attendance windows for each session
      const sessionsWithWindows = await Promise.all(
        upcomingSessions.map(async (session: Session) => {
          try {
            const windowsRes = await api.get(`/api/sessions/${session.id}/attendance-windows`);
            return {
              ...session,
              attendanceWindows: windowsRes.data?.data || windowsRes.data || []
            };
          } catch {
            return { ...session, attendanceWindows: [] };
          }
        })
      );

      // Filter out sessions with no attendance windows
      setSessions(sessionsWithWindows.filter(s => s.attendanceWindows && s.attendanceWindows.length > 0));
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isWindowActive = (window: AttendanceWindow) => {
    const now = new Date();
    const start = new Date(window.startTime);
    const end = new Date(window.endTime);
    return now >= start && now <= end;
  };

  const isWindowUpcoming = (window: AttendanceWindow) => {
    const now = new Date();
    const start = new Date(window.startTime);
    return start > now;
  };

  const getCheckInUrl = (windowId: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/attendance/check-in/${windowId}`;
  };

  const openQRFullscreen = (windowId: string) => {
    window.open(`/attendance/qr-fullscreen/${windowId}`, '_blank');
  };

  const QRModal: React.FC<{ window: AttendanceWindow }> = ({ window }) => {
    const checkInUrl = getCheckInUrl(window.id);
    const session = sessions.find(s =>
      s.attendanceWindows?.some(w => w.id === window.id)
    );

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {window.label}
              </h2>
              <p className="text-sm text-slate-600 mt-1">{session?.title}</p>
            </div>
            <button
              onClick={() => setShowQRModal(false)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* QR Code Display */}
            <div className="flex flex-col items-center">
              <div className="bg-white p-6 rounded-xl border-4 border-amber-400 shadow-lg">
                <QRCodeSVG
                  value={checkInUrl}
                  size={280}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="mt-4 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Scan to Check In
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatTime(window.startTime)} - {formatTime(window.endTime)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => openQRFullscreen(window.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
                Open Fullscreen QR
              </button>

              <Link
                to={`/attendance/mark/${session?.id}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Mark Attendance Manually
              </Link>

              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 text-center">
                  Check-in URL:
                </p>
                <p className="text-xs text-slate-700 font-mono mt-1 break-all text-center">
                  {checkInUrl}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-slate-900 text-base">Quick Attendance</h3>
        </div>
        <div className="text-center py-8 text-sm text-slate-500">
          Loading sessions...
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <QrCode className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-slate-900 text-base">Quick Attendance</h3>
        </div>
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No upcoming sessions</p>
          <p className="text-xs text-slate-500 mt-1">
            Create a session to start marking attendance
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-slate-900 text-base">Quick Attendance</h3>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-3">
          {sessions.map((session) => {
            const windows = session.attendanceWindows || [];
            const activeWindows = windows.filter(isWindowActive);
            const upcomingWindows = windows.filter(isWindowUpcoming);

            if (windows.length === 0) return null;

            return (
              <div
                key={session.id}
                className="border border-slate-200 rounded-xl p-4 hover:border-amber-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-slate-900">
                      {session.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(session.scheduledDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(session.startTime)} - {formatTime(session.endTime)}
                      </span>
                    </div>
                  </div>

                  {activeWindows.length > 0 && (
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Active Now
                    </span>
                  )}
                </div>

                {/* Attendance Windows */}
                <div className="space-y-2">
                  {windows.map((window) => {
                    const isActive = isWindowActive(window);
                    const isUpcoming = isWindowUpcoming(window);

                    return (
                      <div
                        key={window.id}
                        className={`p-3 rounded-lg border ${
                          isActive
                            ? 'bg-green-50 border-green-300'
                            : isUpcoming
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-900">
                              {window.label}
                            </p>
                            <p className="text-xs text-slate-600">
                              {formatTime(window.startTime)} - {formatTime(window.endTime)}
                            </p>
                          </div>
                          {isActive && (
                            <span className="text-xs font-semibold text-green-700">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedWindow(window);
                              setShowQRModal(true);
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${
                              isActive
                                ? 'bg-amber-600 text-white hover:bg-amber-700'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            Show QR
                          </button>

                          <Link
                            to={`/attendance/mark/${session.id}?windowId=${window.id}`}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${
                              isActive
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Mark
                          </Link>

                          <button
                            onClick={() => openQRFullscreen(window.id)}
                            className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                            title="Open fullscreen QR"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <Link
            to="/batches"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 justify-center"
          >
            View all sessions & batches
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && selectedWindow && (
        <QRModal window={selectedWindow} />
      )}
    </>
  );
};
