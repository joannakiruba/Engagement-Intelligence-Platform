import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { studentCheckIn } from '../../services/attendance.service';

type CheckInState = 'scanning' | 'loading' | 'success' | 'flagged' | 'already' | 'error';

export default function StudentCheckIn() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CheckInState>('scanning');
  const [message, setMessage] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [flagReasons, setFlagReasons] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processedRef = useRef(false);

  const paramWindowId = searchParams.get('windowId') || '';
  const paramToken = searchParams.get('token') || '';

  async function doCheckIn(windowId: string, token: string) {
    if (processedRef.current) return;
    processedRef.current = true;
    setState('loading');
    try {
      const res = await studentCheckIn(windowId, token);
      const data = res.data ?? res;
      setSessionTitle(data.session?.title || '');

      if (data.flagged) {
        setState('flagged');
        setFlagReasons(data.flags || []);
        setMessage('Attendance recorded, but your check-in has been flagged for review.');
      } else {
        setState('success');
        setMessage('Attendance marked successfully!');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Check-in failed';
      if (err.response?.status === 409) {
        setState('already');
        setMessage('You have already checked in for this window.');
      } else {
        setState('error');
        setMessage(errMsg);
      }
    }
  }

  function parseQRUrl(url: string): { windowId: string; token: string } | null {
    try {
      const parsed = new URL(url);
      const windowId = parsed.searchParams.get('windowId');
      const token = parsed.searchParams.get('token');
      if (windowId && token) return { windowId, token };
    } catch {
      // not a URL
    }
    return null;
  }

  function stopScanner() {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear();
      scannerRef.current = null;
    }
  }

  function startScanner() {
    processedRef.current = false;
    setCameraError('');

    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const parsed = parseQRUrl(decodedText);
          if (parsed) {
            stopScanner();
            doCheckIn(parsed.windowId, parsed.token);
          }
        },
        () => {},
      )
      .catch((err: any) => {
        setCameraError(
          err?.message?.includes('NotAllowedError')
            ? 'Camera permission denied. Please allow camera access and try again.'
            : 'Could not start camera. Please check permissions or try a different browser.',
        );
      });
  }

  useEffect(() => {
    if (paramWindowId && paramToken) {
      doCheckIn(paramWindowId, paramToken);
      return;
    }
    startScanner();
    return () => stopScanner();
  }, [paramWindowId, paramToken]);

  function handleRetry() {
    processedRef.current = false;
    setState('scanning');
    setMessage('');
    setCameraError('');
    startScanner();
  }

  const FLAG_LABELS: Record<string, string> = {
    IP_MISMATCH: 'Network mismatch — you may not be on the same network as your trainer.',
    DEVICE_CONFLICT: 'This device is registered to another student.',
    DEVICE_RESET: 'New device detected.',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center space-y-4">
        {/* Scanner view */}
        {state === 'scanning' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Scan QR Code</h1>
            <p className="text-xs text-slate-500">Point your camera at the QR code displayed by your trainer.</p>

            <div
              id="qr-reader"
              className="mx-auto rounded-xl overflow-hidden border-2 border-indigo-200"
              style={{ width: '100%', maxWidth: 320 }}
            />

            {cameraError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {cameraError}
                <button
                  onClick={handleRetry}
                  className="block mt-2 mx-auto px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <>
            <div className="text-4xl mb-2">&#8987;</div>
            <h1 className="text-xl font-bold text-slate-800">Checking In...</h1>
            <p className="text-sm text-slate-500">Verifying your attendance and network.</p>
          </>
        )}

        {/* Success */}
        {state === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-green-800">Attendance Marked!</h1>
            {sessionTitle && <p className="text-sm text-slate-600">{sessionTitle}</p>}
            <p className="text-sm text-green-600 font-medium">{message}</p>
          </>
        )}

        {/* Flagged */}
        {state === 'flagged' && (
          <>
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-yellow-800">Attendance Recorded — Flagged</h1>
            {sessionTitle && <p className="text-sm text-slate-600">{sessionTitle}</p>}
            <p className="text-sm text-yellow-700 font-medium">{message}</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left text-xs">
              <p className="font-semibold text-yellow-800 mb-1">Reasons:</p>
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                {flagReasons.map((reason) => (
                  <li key={reason}>{FLAG_LABELS[reason] || reason}</li>
                ))}
              </ul>
              <p className="text-yellow-600 text-[10px] mt-2">An admin will review this flag. If this is a mistake, contact your trainer.</p>
            </div>
          </>
        )}

        {/* Already checked in */}
        {state === 'already' && (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-blue-800">Already Checked In</h1>
            <p className="text-sm text-blue-600">{message}</p>
          </>
        )}

        {/* Error */}
        {state === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-red-800">Check-In Failed</h1>
            <p className="text-sm text-red-600">{message}</p>
            <button
              onClick={handleRetry}
              className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
            >
              Scan Again
            </button>
          </>
        )}

        <Link to="/" className="block pt-2 text-xs text-slate-400 hover:text-slate-600">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
