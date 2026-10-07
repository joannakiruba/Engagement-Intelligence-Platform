import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { studentCheckIn } from '../../services/attendance.service';

type CheckInState = 'loading' | 'success' | 'flagged' | 'already' | 'error';

export default function StudentCheckIn() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CheckInState>('loading');
  const [message, setMessage] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [flagReasons, setFlagReasons] = useState<string[]>([]);

  const windowId = searchParams.get('windowId') || '';
  const token = searchParams.get('token') || '';

  useEffect(() => {
    if (!windowId) {
      setState('error');
      setMessage('Missing window ID. Please scan the QR code again.');
      return;
    }
    if (!token) {
      setState('error');
      setMessage('Missing QR token. Please scan the QR code displayed by your trainer.');
      return;
    }
    doCheckIn();
  }, [windowId, token]);

  async function doCheckIn() {
    setState('loading');
    try {
      const res = await studentCheckIn(windowId, token);
      const data = res.data;
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

  const FLAG_LABELS: Record<string, string> = {
    IP_MISMATCH: 'Network mismatch — you may not be on the same network as your trainer.',
    DEVICE_CONFLICT: 'This device is registered to another student.',
    DEVICE_RESET: 'New device detected.',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {state === 'loading' && (
          <>
            <div className="text-4xl mb-4">&#8987;</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Checking In...</h1>
            <p className="text-gray-500">Verifying your attendance and network.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-green-800 mb-2">Attendance Marked!</h1>
            {sessionTitle && <p className="text-gray-600 mb-2">{sessionTitle}</p>}
            <p className="text-green-600 font-medium">{message}</p>
          </>
        )}

        {state === 'flagged' && (
          <>
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-yellow-800 mb-2">Attendance Recorded — Flagged</h1>
            {sessionTitle && <p className="text-gray-600 mb-2">{sessionTitle}</p>}
            <p className="text-yellow-700 font-medium mb-3">{message}</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-left text-sm">
              <p className="font-medium text-yellow-800 mb-1">Reasons:</p>
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                {flagReasons.map((reason) => (
                  <li key={reason}>{FLAG_LABELS[reason] || reason}</li>
                ))}
              </ul>
              <p className="text-yellow-600 text-xs mt-2">An admin will review this flag. If this is a mistake, contact your trainer.</p>
            </div>
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
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-red-800 mb-2">Check-In Failed</h1>
            <p className="text-red-600">{message}</p>
            <button
              onClick={doCheckIn}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Try Again
            </button>
          </>
        )}

        <Link to="/" className="block mt-6 text-sm text-gray-400 hover:text-gray-600">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
