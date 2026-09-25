import { Routes, Route, Link } from 'react-router-dom';
import BatchDetail from './pages/batches/BatchDetail';
import MarkAttendance from './pages/attendance/MarkAttendance';
import SessionAttendance from './pages/attendance/SessionAttendance';
import StudentAttendance from './pages/attendance/StudentAttendance';
import QRFullscreen from './pages/attendance/QRFullscreen';
import StudentCheckIn from './pages/attendance/StudentCheckIn';
import AttendanceReport from './pages/attendance/AttendanceReport';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold text-gray-800">
            EIP
          </Link>
          <Link to="/attendance" className="text-gray-600 hover:text-gray-900">
            Attendance
          </Link>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/batches/:id" element={<BatchDetail />} />
          <Route path="/attendance/mark/:sessionId" element={<MarkAttendance />} />
          <Route path="/attendance/session/:sessionId" element={<SessionAttendance />} />
          <Route path="/attendance/student/:studentId" element={<StudentAttendance />} />
          <Route path="/attendance/qr/:windowId" element={<QRFullscreen />} />
          <Route path="/attendance/check-in" element={<StudentCheckIn />} />
          <Route path="/attendance/report/:batchId" element={<AttendanceReport />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
