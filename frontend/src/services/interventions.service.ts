import api from './api';

export interface InterventionTask {
  id: string;
  interventionId: string;
  title: string;
  description: string | null;
  deadline: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterventionNote {
  id: string;
  interventionId: string;
  note: string;
  editedAt: string | null;
  createdAt: string;
}

export interface InterventionOutcome {
  id: string;
  interventionId: string;
  outcome: 'IMPROVED' | 'NO_CHANGE' | 'DECLINED';
  remarks: string | null;
  recordedAt: string;
}

export interface Intervention {
  id: string;
  studentId: string;
  mentorId: string;
  riskScoreId: string | null;
  causeCode: string | null;
  alertId: number | null;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  deadline: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  student: { id: string; name: string; email: string };
  mentor: { id: string; name: string; email: string };
  riskScore: { id: string; totalScore: number; riskLevel: string; generatedAt: string } | null;
  tasks: InterventionTask[];
  updates: InterventionNote[];
  outcome: InterventionOutcome | null;
}

export interface AlertCause {
  id: number;
  cause_code: string;
  evidence: Record<string, unknown>;
}

export interface MentorAlert {
  id: number;
  student_id: string;
  mentor_id: string;
  student_name: string;
  batch_name: string | null;
  priority_score: number;
  urgency_tier: string;
  trigger_reason: string;
  risk_score: number;
  risk_velocity: number;
  recommended_intervention: string;
  recommendation_confidence: number;
  recommendation_reasoning: string;
  alert_status: string;
  created_at: string;
  causes: AlertCause[];
  interventions: Array<{ id: string; causeCode: string; status: string; title: string }>;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

// ── Interventions ──

export async function listInterventions(params: Record<string, string> = {}) {
  const res = await api.get('/api/interventions', { params });
  return res.data;
}

export async function getIntervention(id: string): Promise<Intervention> {
  const res = await api.get(`/api/interventions/${id}`);
  return res.data.data;
}

export async function createIntervention(data: {
  alertId: number;
  causeCode: string;
  title: string;
  description?: string;
  deadline?: string;
}): Promise<{ existing: boolean; intervention: Intervention }> {
  const res = await api.post('/api/interventions', data);
  return res.data.data;
}

export async function updateIntervention(
  id: string,
  data: { title?: string; description?: string; deadline?: string | null; status?: string },
): Promise<Intervention> {
  const res = await api.patch(`/api/interventions/${id}`, data);
  return res.data.data;
}

export async function completeIntervention(
  id: string,
  data: { outcome: string; remarks?: string },
): Promise<Intervention> {
  const res = await api.post(`/api/interventions/${id}/complete`, data);
  return res.data.data;
}

export async function editOutcome(
  id: string,
  data: { outcome: string; remarks?: string },
): Promise<InterventionOutcome> {
  const res = await api.patch(`/api/interventions/${id}/outcome`, data);
  return res.data.data;
}

export async function getPendingCount(): Promise<number> {
  const res = await api.get('/api/interventions/pending-count');
  return res.data.data.count;
}

// ── Tasks ──

export async function createTask(
  interventionId: string,
  data: { title: string; description?: string; deadline?: string | null },
): Promise<InterventionTask> {
  const res = await api.post(`/api/interventions/${interventionId}/tasks`, data);
  return res.data.data;
}

export async function updateTask(
  interventionId: string,
  taskId: string,
  data: { title?: string; description?: string; deadline?: string | null; isCompleted?: boolean },
): Promise<InterventionTask> {
  const res = await api.patch(`/api/interventions/${interventionId}/tasks/${taskId}`, data);
  return res.data.data;
}

// ── Notes ──

export async function createNote(
  interventionId: string,
  note: string,
): Promise<InterventionNote> {
  const res = await api.post(`/api/interventions/${interventionId}/notes`, { note });
  return res.data.data;
}

export async function updateNote(
  interventionId: string,
  noteId: string,
  note: string,
): Promise<InterventionNote> {
  const res = await api.patch(`/api/interventions/${interventionId}/notes/${noteId}`, { note });
  return res.data.data;
}

export async function deleteNote(
  interventionId: string,
  noteId: string,
): Promise<void> {
  await api.delete(`/api/interventions/${interventionId}/notes/${noteId}`);
}

// ── Alerts ──

export async function getMentorAlerts(): Promise<MentorAlert[]> {
  const res = await api.get('/api/interventions/alerts');
  return res.data.data;
}

// ── Notifications ──

export async function getNotifications(params: Record<string, string> = {}): Promise<{
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
}> {
  const res = await api.get('/api/notifications', { params });
  return res.data.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get('/api/notifications/unread-count');
  return res.data.data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/api/notifications/mark-all-read');
}
