import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { studentCheckIn } from '../../services/attendance.service';

type CheckInState = 'loading' | 'success' | 'already' | 'error';

export default function StudentCheckIn() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CheckInState>('loading');
  const [message, setMessage] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');

  const windowId = searchParams.get('windowId') || '';
  const token = searchParams.get('token') || '';

  useEffect(() => {
    if (!windowId) {
      setState('error');
      setMessage('Missing window ID. Please scan the QR code again.');
      return;
    }
    doCheckIn();
  }, [windowId, token]);

  async function doCheckIn() {
    setState('loading');
    try {
      const res = await studentCheckIn(windowId, token || undefined);
      const data = res.data;
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {state === 'loading' && (
          <>
            <div className="text-4xl mb-4">&#8987;</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Checking In...</h1>
            <p className="text-gray-500">Please wait while we record your attendance.</p>
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
