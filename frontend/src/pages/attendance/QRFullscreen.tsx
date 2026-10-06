import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getWindowQR } from '../../services/attendance.service';

interface QRData {
  token: string;
  expiresInSeconds?: number;
  refreshIntervalSeconds?: number;
  windowId: string;
  sessionId?: string;
  label: string;
  isOpen?: boolean;
  checkedInCount?: number;
  windowStart?: string;
  windowEnd?: string;
  startTime?: string;
  endTime?: string;
}

export function QRFullscreen() {
  const { sessionId, windowId } = useParams<{ sessionId?: string; windowId?: string }>();
  const idToUse = windowId || sessionId;
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchQR() {
    if (!idToUse) return;
    try {
      const res: any = await getWindowQR(idToUse);
      const data = res?.data ?? res;
      setQrData(data);
      setCountdown(data.expiresInSeconds || data.refreshIntervalSeconds || 60);
      setError('');
    } catch {
      setError('Failed to generate QR code');
    }
  }

  useEffect(() => {
    fetchQR();
    const refreshInterval = setInterval(fetchQR, 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [idToUse]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchQR();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [qrData?.token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <p className="text-xl">{error}</p>
          <button onClick={fetchQR} className="mt-4 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white text-xl">Loading dynamic QR code...</p>
      </div>
    );
  }

  const baseUrl = window.location.origin;
  const checkInUrl = `${baseUrl}/attendance/check-in?windowId=${qrData.windowId}&token=${qrData.token}`;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Scan to Mark Attendance</h1>
        <p className="text-indigo-400 text-lg font-semibold">{qrData.label}</p>
        {(qrData.windowStart || qrData.startTime) && (
          <p className="text-gray-500 text-sm mt-1">
            Window: {new Date(qrData.windowStart || qrData.startTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(qrData.windowEnd || qrData.endTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-2xl p-8 shadow-2xl mb-8 border-4 border-indigo-500">
        <QRCodeSVG
          value={checkInUrl}
          size={360}
          level="M"
          includeMargin={true}
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-12 text-center mb-6">
        <div>
          <div className="text-5xl font-bold text-green-400">{qrData.checkedInCount ?? 1}</div>
          <div className="text-gray-400 text-sm mt-1">Checked In</div>
        </div>
        <div>
          <div className={`text-5xl font-bold ${countdown <= 10 ? 'text-rose-400' : 'text-indigo-400'}`}>
            {countdown}s
          </div>
          <div className="text-gray-400 text-sm mt-1">Token Refresh</div>
        </div>
      </div>

      {/* Status indicator */}
      <div className={`px-4 py-2 rounded-full text-sm font-medium ${
        qrData.isOpen !== false
          ? 'bg-green-900 text-green-300'
          : 'bg-red-900 text-red-300'
      }`}>
        {qrData.isOpen !== false ? 'Live Window Open' : 'Window Closed'}
      </div>
    </div>
  );
}
export default QRFullscreen;
