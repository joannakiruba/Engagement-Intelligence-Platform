import { Request, Response } from 'express';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import prisma from '../lib/prisma';
import * as svc from '../services/interventions.service';
import type { ResolvedScope } from '../auth/rbac.middleware';

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

async function verifyAlertOwnership(alertId: number, mentorId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number; student_id: string; mentor_id: string }>>(
    `SELECT id, student_id, mentor_id FROM ml_mentor_alerts WHERE id = $1`,
    alertId,
  );
  if (!rows.length) return { valid: false, reason: 'Alert not found.' } as const;
  const alert = rows[0];
  if (alert.mentor_id !== mentorId) return { valid: false, reason: 'Alert does not belong to you.' } as const;
  return { valid: true, alert } as const;
}

async function verifyMentorAssignment(mentorId: string, studentId: string) {
  const assignment = await prisma.mentorAssignment.findUnique({
    where: { mentorId_studentId: { mentorId, studentId } },
  });
  return !!assignment;
}

async function verifyAlertCause(alertId: number, causeCode: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM ml_alert_causes WHERE alert_id = $1 AND cause_code = $2`,
    alertId,
    causeCode,
  );
  return rows.length > 0;
}

function isTerminal(status: string) {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

// ── Interventions ──

export async function create(req: Request, res: Response): Promise<void> {
  const mentorId = req.user!.sub;
  const { alertId, causeCode, title, description, deadline } = req.body;

  const alertCheck = await verifyAlertOwnership(alertId, mentorId);
  if (!alertCheck.valid) {
    sendError(res, alertCheck.reason, 403);
    return;
  }

  const isAssigned = await verifyMentorAssignment(mentorId, alertCheck.alert.student_id);
  if (!isAssigned) {
    sendError(res, 'Student is not assigned to you.', 403);
    return;
  }

  const causeValid = await verifyAlertCause(alertId, causeCode);
  if (!causeValid) {
    sendError(res, 'Selected cause does not belong to this alert.', 400);
    return;
  }

  const latestRisk = await prisma.riskScore.findFirst({
    where: { studentId: alertCheck.alert.student_id },
    orderBy: { generatedAt: 'desc' },
    select: { id: true },
  });

  const result = await svc.createIntervention({
    studentId: alertCheck.alert.student_id,
    mentorId,
    alertId,
    causeCode,
    title,
    description: description || '',
    deadline: deadline ? new Date(deadline) : undefined,
    riskScoreId: latestRisk?.id,
  });

  if (result.existing) {
    sendSuccess(res, { existing: true, intervention: result.intervention }, 200);
    return;
  }

  sendSuccess(res, { existing: false, intervention: result.intervention }, 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  const scope: ResolvedScope = (req as any).resolvedScope || 'none';
  const userId = req.user!.sub;
  const { status, studentId, hasOverdueTasks, page, limit } = req.query as any;

  const opts: svc.ListInterventionsOpts = {
    status: status || undefined,
    hasOverdueTasks: hasOverdueTasks === 'true',
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  };

  if (scope === 'any') {
    if (studentId) opts.studentId = studentId;
  } else if (scope === 'assigned') {
    opts.mentorId = userId;
    if (studentId) opts.studentId = studentId;
  } else if (scope === 'own') {
    opts.studentId = userId;
  } else {
    sendError(res, 'Insufficient permissions.', 403);
    return;
  }

  const { interventions, total } = await svc.listInterventions(opts);
  sendPaginated(res, interventions, total, opts.page, opts.limit);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const scope: ResolvedScope = (req as any).resolvedScope || 'none';
  const userId = req.user!.sub;

  const intervention = await svc.getInterventionById(param(req, 'id'));
  if (!intervention) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }

  if (scope === 'any') { /* allowed */ }
  else if (scope === 'assigned' && intervention.mentorId !== userId) {
    sendError(res, 'Intervention not found.', 404);
    return;
  } else if (scope === 'own' && intervention.studentId !== userId) {
    sendError(res, 'Intervention not found.', 404);
    return;
  } else if (scope === 'none') {
    sendError(res, 'Insufficient permissions.', 403);
    return;
  }

  sendSuccess(res, intervention);
}

export async function update(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const intervention = await svc.getInterventionById(param(req, 'id'));
  if (!intervention) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (intervention.mentorId !== userId) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (isTerminal(intervention.status)) {
    sendError(res, 'Cannot modify a completed or cancelled intervention.', 400);
    return;
  }

  const { title, description, deadline, status } = req.body;

  if (status === 'CANCELLED' && isTerminal(intervention.status)) {
    sendError(res, 'Intervention is already terminal.', 400);
    return;
  }

  const updated = await svc.updateIntervention(intervention.id, { title, description, deadline, status });
  sendSuccess(res, updated);
}

export async function complete(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const intervention = await svc.getInterventionById(param(req, 'id'));
  if (!intervention) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (intervention.mentorId !== userId) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (isTerminal(intervention.status)) {
    sendError(res, 'Intervention is already terminal.', 400);
    return;
  }

  const { outcome, remarks } = req.body;
  const result = await svc.completeIntervention(intervention.id, outcome, remarks);
  sendSuccess(res, result);
}

export async function editOutcome(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const intervention = await svc.getInterventionById(param(req, 'id'));
  if (!intervention) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (intervention.mentorId !== userId) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (intervention.status !== 'COMPLETED' || !intervention.outcome) {
    sendError(res, 'No outcome to edit.', 400);
    return;
  }

  const { outcome, remarks } = req.body;
  const updated = await svc.editOutcome(intervention.id, outcome, remarks);
  sendSuccess(res, updated);
}

export async function pendingCount(req: Request, res: Response): Promise<void> {
  const mentorId = req.user!.sub;
  const count = await svc.getPendingCount(mentorId);
  sendSuccess(res, { count });
}

// ── Tasks ──

export async function createTask(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const intervention = await svc.getInterventionById(param(req, 'id'));
  if (!intervention) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (intervention.mentorId !== userId) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (isTerminal(intervention.status)) {
    sendError(res, 'Cannot add tasks to a terminal intervention.', 400);
    return;
  }

  const { title, description, deadline } = req.body;
  const task = await svc.createTask(intervention.id, {
    title,
    description,
    deadline: deadline ? new Date(deadline) : null,
  });
  sendSuccess(res, task, 201);
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const task = await svc.getTaskById(param(req, 'taskId'));
  if (!task) {
    sendError(res, 'Task not found.', 404);
    return;
  }
  if (task.intervention.mentorId !== userId) {
    sendError(res, 'Task not found.', 404);
    return;
  }
  if (task.intervention.id !== param(req, 'id')) {
    sendError(res, 'Task not found.', 404);
    return;
  }
  if (isTerminal(task.intervention.status)) {
    sendError(res, 'Cannot modify tasks on a terminal intervention.', 400);
    return;
  }

  const { title, description, deadline, isCompleted } = req.body;
  const updated = await svc.updateTask(task.id, { title, description, deadline, isCompleted });
  sendSuccess(res, updated);
}

// ── Notes ──

export async function createNote(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const intervention = await svc.getInterventionById(param(req, 'id'));
  if (!intervention) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (intervention.mentorId !== userId) {
    sendError(res, 'Intervention not found.', 404);
    return;
  }
  if (isTerminal(intervention.status)) {
    sendError(res, 'Cannot add notes to a terminal intervention.', 400);
    return;
  }

  const note = await svc.createNote(intervention.id, req.body.note);
  sendSuccess(res, note, 201);
}

export async function updateNote(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const existing = await svc.getNoteById(param(req, 'noteId'));
  if (!existing) {
    sendError(res, 'Note not found.', 404);
    return;
  }
  if (existing.intervention.mentorId !== userId) {
    sendError(res, 'Note not found.', 404);
    return;
  }
  if (existing.interventionId !== param(req, 'id')) {
    sendError(res, 'Note not found.', 404);
    return;
  }

  const updated = await svc.updateNote(existing.id, req.body.note);
  sendSuccess(res, updated);
}

export async function deleteNote(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const existing = await svc.getNoteById(param(req, 'noteId'));
  if (!existing) {
    sendError(res, 'Note not found.', 404);
    return;
  }
  if (existing.intervention.mentorId !== userId) {
    sendError(res, 'Note not found.', 404);
    return;
  }
  if (existing.interventionId !== param(req, 'id')) {
    sendError(res, 'Note not found.', 404);
    return;
  }

  await svc.deleteNote(existing.id);
  sendSuccess(res, { deleted: true });
}

// ── Alerts with causes ──

export async function getAlertsForMentor(req: Request, res: Response): Promise<void> {
  const mentorId = req.user!.sub;
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT a.*,
           u.name AS student_name,
           b.name AS batch_name,
           COALESCE(
             (SELECT json_agg(json_build_object(
               'id', c.id,
               'cause_code', c.cause_code,
               'evidence', c.evidence
             )) FROM ml_alert_causes c WHERE c.alert_id = a.id),
             '[]'::json
           ) AS causes,
           COALESCE(
             (SELECT json_agg(json_build_object(
               'id', i.id,
               'causeCode', i."causeCode",
               'status', i.status,
               'title', i.title
             )) FROM interventions i WHERE i."alertId" = a.id),
             '[]'::json
           ) AS interventions
    FROM ml_mentor_alerts a
    LEFT JOIN users u ON u.id = a.student_id
    LEFT JOIN batches b ON b.id = a.batch_id
    WHERE a.mentor_id = $1
    ORDER BY a.priority_score DESC, a.created_at DESC
  `, mentorId);

  sendSuccess(res, rows);
}
