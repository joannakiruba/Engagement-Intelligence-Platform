import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  ServiceError,
  studentCheckIn,
  markAttendance,
  bulkMarkAttendance,
  updateAttendance,
  getWindowAttendance,
  getSessionAttendance,
  getStudentAttendance,
  getBatchAttendanceStats,
  exportSessionAttendanceCsv,
  exportBatchAttendanceExcel,
  generateQRForWindow,
  createAttendanceWindow,
  getSessionWindows,
} from '../services/attendance.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ServiceError) {
    return sendError(res, err.message, err.statusCode);
  }
  next(err);
}

export async function checkInHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.body.studentId || String(req.params.studentId);
    const result = await studentCheckIn(req.body.windowId, studentId, req.body.qrToken);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function markAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { windowId, studentId, status, remarks } = req.body;
    const result = await markAttendance(windowId, studentId, status, remarks);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function bulkMarkHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { windowId, records } = req.body;
    const result = await bulkMarkAttendance(windowId, records);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateAttendance(String(req.params.id), req.body);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getWindowAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getWindowAttendance(String(req.params.windowId));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getSessionAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getSessionAttendance(String(req.params.sessionId));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getStudentAttendanceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: { batchId?: string; from?: string; to?: string } = {};
    if (req.query.batchId) filters.batchId = String(req.query.batchId);
    if (req.query.from) filters.from = String(req.query.from);
    if (req.query.to) filters.to = String(req.query.to);
    const result = await getStudentAttendance(String(req.params.studentId), filters);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getBatchStatsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getBatchAttendanceStats(String(req.params.batchId));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function exportCsvHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = String(req.params.sessionId);
    const csv = await exportSessionAttendanceCsv(sessionId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${sessionId}.csv"`);
    return res.send(csv);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function exportExcelHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = String(req.params.batchId);
    const filters: { from?: string; to?: string; sessionId?: string } = {};
    if (req.query.from) filters.from = String(req.query.from);
    if (req.query.to) filters.to = String(req.query.to);
    if (req.query.sessionId) filters.sessionId = String(req.query.sessionId);

    const workbook = await exportBatchAttendanceExcel(batchId, filters);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${batchId}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function generateQRHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await generateQRForWindow(String(req.params.windowId));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function createWindowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId, label, startTime, endTime } = req.body;
    const result = await createAttendanceWindow(sessionId, label, new Date(startTime), new Date(endTime));
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getSessionWindowsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getSessionWindows(String(req.params.sessionId));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
