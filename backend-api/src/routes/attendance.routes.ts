import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { requirePermission } from '../auth/rbac.middleware';
import {
  checkInSchema,
  markAttendanceSchema,
  bulkMarkAttendanceSchema,
  updateAttendanceSchema,
  createWindowSchema,
  resolveFlagSchema,
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
  getFlagsHandler,
  resolveFlagHandler,
  getFlagStatsHandler,
} from '../controllers/attendance.controller';

const router = Router();

// Attendance windows
router.post('/windows', requirePermission('attendance:mark:batch'), validate(createWindowSchema), createWindowHandler);
router.get('/session/:sessionId/windows', requirePermission('attendance:read:batch', 'attendance:read:any'), getSessionWindowsHandler);

// Student self-check-in (window time enforced server-side)
router.post('/check-in', requirePermission('attendance:mark:self'), validate(checkInSchema), checkInHandler);

// Trainer marks single student
router.post('/mark', requirePermission('attendance:mark:batch'), validate(markAttendanceSchema), markAttendanceHandler);

// Trainer bulk marks entire window
router.post('/bulk', requirePermission('attendance:mark:batch'), validate(bulkMarkAttendanceSchema), bulkMarkHandler);

// Trainer updates existing record (override)
router.put('/:id', requirePermission('attendance:update:batch', 'attendance:update:any'), validate(updateAttendanceSchema), updateAttendanceHandler);

// Get attendance for a specific window
router.get('/window/:windowId', requirePermission('attendance:read:own', 'attendance:read:batch', 'attendance:read:assigned', 'attendance:read:any'), getWindowAttendanceHandler);

// Get all attendance for a session (all windows combined)
router.get('/session/:sessionId', requirePermission('attendance:read:own', 'attendance:read:batch', 'attendance:read:assigned', 'attendance:read:any'), getSessionAttendanceHandler);

// Get attendance history for a student (supports ?batchId=&from=&to= filters)
router.get('/student/:studentId', requirePermission('attendance:read:own', 'attendance:read:batch', 'attendance:read:assigned', 'attendance:read:any'), getStudentAttendanceHandler);

// Get batch-level attendance stats
router.get('/batch/:batchId/stats', requirePermission('attendance:read:batch', 'attendance:read:any'), getBatchStatsHandler);

// Export session attendance as CSV
router.get('/session/:sessionId/export', requirePermission('attendance:export'), exportCsvHandler);

// Export batch attendance as Excel
router.get('/batch/:batchId/export', requirePermission('attendance:export'), exportExcelHandler);

// Generate time-rotating QR token for a window (trainer calls this)
router.get('/window/:windowId/qr', requirePermission('attendance:mark:batch'), generateQRHandler);

// Get all excused records for trainer review (?batchId=&sessionId=&from=&to=)
router.get('/excused', requirePermission('attendance:read:batch', 'attendance:read:any'), getExcusedRecordsHandler);

// Attendance fraud flags (admin)
router.get('/flags', requirePermission('attendance:read:any'), getFlagsHandler);
router.get('/flags/stats', requirePermission('attendance:read:any'), getFlagStatsHandler);
router.put('/flags/:id', requirePermission('attendance:update:any'), validate(resolveFlagSchema), resolveFlagHandler);

export default router;
