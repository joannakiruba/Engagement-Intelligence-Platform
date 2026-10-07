import api from './api';
// Fetch all pages because the supplied UI has no server-side pagination controls.
export async function getList(path: string, params: Record<string, unknown> = {}, key?: string): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; ; page++) {
    const { data: body } = await api.get(path, { params: { ...params, page, limit: 100 } });
    const data = body.data;
    const rows = key ? data[key] : data;
    if (!Array.isArray(rows)) throw new Error('Unexpected list response from ' + path);
    all.push(...rows);
    const meta = key ? data : body.pagination;
    if (!meta || all.length >= meta.total || rows.length === 0) return all;
  }
}
export const normalizeTask = (d: any) => ({ ...d, batchIds: d.batchIds ?? d.taskBatches?.map((b: any) => b.batchId) ?? d.batches?.map((b: any) => b.id) ?? [] });
export const normalizeEvent = (d: any) => ({ ...d, eventType: d.category ?? d.eventType, eventDate: d.startDate ?? d.eventDate, registrations: d.registrations ?? [] });
export const normalizeAlert = (d: any) => ({ ...d, mentorId: d.mentor_id ?? d.mentorId, studentId: d.student_id ?? d.studentId, riskScore: d.risk_score ?? d.riskScore, riskCategory: d.risk_category ?? d.urgency_tier ?? d.riskCategory, suggestedAction: d.recommended_intervention ?? d.suggested_action ?? d.recommended_action ?? d.suggestedAction, createdAt: d.created_at ?? d.createdAt, student: d.student ?? (d.student_name ? { id: d.student_id, name: d.student_name } : undefined) });
