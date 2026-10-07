import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getWindowQR } from '../../services/attendance.service';

interface QRData {
  token: string;
  expiresInSeconds: number;
  windowId: string;
  sessionId: string;
  label: string;
  isOpen: boolean;
  checkedInCount: number;
  windowStart: string;
  windowEnd: string;
}

export default function QRFullscreen() {
  const { windowId } = useParams<{ windowId: string }>();
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchQR() {
    if (!windowId) return;
    try {
      const res = await getWindowQR(windowId);
      const data = res.data;
      setQrData(data);
      setCountdown(data.expiresInSeconds);
      setError('');
    } catch {
      setError('Failed to generate QR code');
    }
  }

  useEffect(() => {
    fetchQR();

    const refreshInterval = setInterval(fetchQR, 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [windowId]);

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
          <button onClick={fetchQR} className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white text-xl">Loading QR code...</p>
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
        <p className="text-gray-400 text-lg">{qrData.label}</p>
        <p className="text-gray-500 text-sm">
          Window: {new Date(qrData.windowStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(qrData.windowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-2xl p-8 shadow-2xl mb-8">
        <QRCodeSVG
          value={checkInUrl}
          size={400}
          level="M"
          includeMargin={true}
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-12 text-center mb-6">
        <div>
          <div className="text-5xl font-bold text-green-400">{qrData.checkedInCount}</div>
          <div className="text-gray-400 text-sm mt-1">Checked In</div>
        </div>
        <div>
          <div className={`text-5xl font-bold ${countdown <= 10 ? 'text-red-400' : 'text-blue-400'}`}>
            {countdown}s
          </div>
          <div className="text-gray-400 text-sm mt-1">Until Refresh</div>
        </div>
      </div>

      {/* Status indicator */}
      <div className={`px-4 py-2 rounded-full text-sm font-medium ${
        qrData.isOpen
          ? 'bg-green-900 text-green-300'
          : 'bg-red-900 text-red-300'
      }`}>
        {qrData.isOpen ? 'Window Open' : 'Window Closed'}
      </div>
    </div>
  );
}
