import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import type { IScannerControls } from '@zxing/browser';
import { studentCheckIn } from '../../services/attendance.service';

type CheckInState = 'loading' | 'success' | 'already' | 'error';

export function StudentCheckIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CheckInState>('loading');
  const [message, setMessage] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const windowId = searchParams.get('windowId') || '';
  const token = searchParams.get('token') || '';
  const handleScan = useCallback((value: string): boolean => {
    try {
      const url = new URL(value, window.location.origin);
      const scannedWindowId = url.searchParams.get('windowId');
      const scannedToken = url.searchParams.get('token');
      if (!scannedWindowId || !scannedToken) {
        setMessage('This QR code is not a valid attendance code. Scan the live code shown by your trainer or mentor.');
        return false;
      }
      navigate(`/attendance/check-in?windowId=${encodeURIComponent(scannedWindowId)}&token=${encodeURIComponent(scannedToken)}`, { replace: true });
      return true;
    } catch {
      setMessage('Could not read this QR code. Try scanning the live attendance code again.');
      return false;
    }
  }, [navigate]);

  useEffect(() => {
    if (!windowId) {
      return;
    }
    doCheckIn();
  }, [windowId, token]);

  async function doCheckIn() {
    setState('loading');
    try {
      const res: any = await studentCheckIn(windowId, token || undefined);
      const data = res?.data ?? res;
      setSessionTitle(data.session?.title || '');
      setState('success');
      setMessage('Attendance marked successfully!');
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

  if (!windowId) {
    return <QRScanner onScan={handleScan} message={message} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200">
        {state === 'loading' && (
          <>
            <div className="text-4xl mb-4">&#8987;</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Checking In...</h1>
            <p className="text-gray-500">Please wait while we record your attendance.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-emerald-800 mb-2">Attendance Marked!</h1>
            {sessionTitle && <p className="text-slate-600 mb-2 font-medium">{sessionTitle}</p>}
            <p className="text-emerald-600 font-medium">{message}</p>
          </>
        )}

        {state === 'already' && (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-blue-800 mb-2">Already Checked In</h1>
            <p className="text-blue-600">{message}</p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-rose-800 mb-2">Check-In Failed</h1>
            <p className="text-rose-600">{message}</p>
            <button
              onClick={doCheckIn}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              Try Again
            </button>
          </>
        )}

        <Link to="/" className="block mt-6 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          &larr; Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

function QRScanner({ onScan, message }: { onScan: (value: string) => boolean; message: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    let active = true;
    let controls: IScannerControls | undefined;
    const startScanner = async () => {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (!active || !videoRef.current) return;
        const reader = new BrowserQRCodeReader();
        const scannerControls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _error, callbackControls) => {
          controls = callbackControls;
          if (active && result && onScan(result.getText())) {
            active = false;
            callbackControls.stop();
          }
        });
        if (active) controls = scannerControls;
        else scannerControls.stop();
      } catch (error: unknown) {
        if (active) {
          setCameraError(error instanceof Error && error.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow camera access in your browser, then reload this page.'
            : 'Could not start the camera. Use HTTPS and allow camera access, then try again.');
        }
      }
    };

    void startScanner();

    return () => {
      active = false;
      controls?.stop();
    };
  }, [onScan]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900">Scan attendance QR</h1>
        <p className="mt-2 text-sm text-slate-600">Point your camera at the live QR code on your trainer&apos;s or mentor&apos;s screen.</p>
        <video ref={videoRef} className="mt-5 aspect-video w-full rounded-xl bg-black object-cover" muted playsInline />
        {(cameraError || message) && <p role="alert" className="mt-4 text-sm text-rose-700">{cameraError || message}</p>}
        <Link to="/" className="mt-5 inline-block text-sm font-medium text-indigo-600">Cancel</Link>
      </div>
    </div>
  );
}

export default StudentCheckIn;
