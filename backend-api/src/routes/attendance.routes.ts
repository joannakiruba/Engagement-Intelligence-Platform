import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import {
  checkInSchema,
  markAttendanceSchema,
  bulkMarkAttendanceSchema,
  updateAttendanceSchema,
  createWindowSchema,
} from '../validators/attendance.validator';
import {
  checkInHandler,
  markAttendanceHandler,
  bulkMarkHandler,
  updateAttendanceHandler,
  getWindowAttendanceHandler,
  getSessionAttendanceHandler,
  getStudentAttendanceHandler,
  getBatchStatsHandler,
  exportCsvHandler,
  exportExcelHandler,
  generateQRHandler,
  createWindowHandler,
  getSessionWindowsHandler,
  getExcusedRecordsHandler,
} from '../controllers/attendance.controller';

const router = Router();

// Attendance windows
router.post('/windows', validate(createWindowSchema), createWindowHandler);
router.get('/session/:sessionId/windows', getSessionWindowsHandler);

// Student self-check-in (window time enforced server-side)
router.post('/check-in', validate(checkInSchema), checkInHandler);

// Trainer marks single student
router.post('/mark', validate(markAttendanceSchema), markAttendanceHandler);

// Trainer bulk marks entire window
router.post('/bulk', validate(bulkMarkAttendanceSchema), bulkMarkHandler);

// Trainer updates existing record (override)
router.put('/:id', validate(updateAttendanceSchema), updateAttendanceHandler);

// Get attendance for a specific window
router.get('/window/:windowId', getWindowAttendanceHandler);

// Get all attendance for a session (all windows combined)
router.get('/session/:sessionId', getSessionAttendanceHandler);

// Get attendance history for a student (supports ?batchId=&from=&to= filters)
router.get('/student/:studentId', getStudentAttendanceHandler);

// Get batch-level attendance stats
router.get('/batch/:batchId/stats', getBatchStatsHandler);

// Export session attendance as CSV
router.get('/session/:sessionId/export', exportCsvHandler);

// Export batch attendance as Excel
router.get('/batch/:batchId/export', exportExcelHandler);

// Generate time-rotating QR token for a window (trainer calls this)
router.get('/window/:windowId/qr', generateQRHandler);

// Get all excused records for trainer review (?batchId=&sessionId=&from=&to=)
router.get('/excused', getExcusedRecordsHandler);

export default router;
