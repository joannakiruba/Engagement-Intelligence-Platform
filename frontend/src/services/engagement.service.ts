import api, { getTokenPermissions } from './api';
export async function getEngagementDashboard() {
  const d = (await api.get('/api/engagement/dashboard')).data.data;
  const canReadRisk = getTokenPermissions().some(p => ['risk_scores:read:any', 'risk_scores:read:assigned'].includes(p));
  const highRisks = canReadRisk ? (await api.get('/api/risk/high')).data.data : null;
  return { ...d, attendanceRate: d.averageAttendanceRate, avgAssessmentScore: d.averageAssessmentScore, highRiskCount: highRisks?.length, batches: d.batches.map((b: any) => ({ ...b, id: b.batchId, name: b.batchName })) };
}
export async function getBatchEngagement(batchId: string) {
  const d = (await api.get('/api/engagement/batch/' + batchId)).data.data;
  return { ...d, students: d.students.map((s: any) => ({ ...s, student: { id: s.studentId, name: s.studentName, email: s.studentEmail } })) };
}
export async function getBatchTrends(batchId: string) {
  const d = (await api.get('/api/engagement/batch/' + batchId + '/trends')).data.data;
  return { ...d, sessions: d.attendance.map((s: any) => ({ ...s, title: s.sessionTitle, date: new Date(s.scheduledDate).toLocaleDateString() })) };
}
export async function getStudentEngagement(studentId: string) {
  const d = (await api.get('/api/engagement/student/' + studentId)).data.data;
  return { ...d, attendanceRate: d.attendance.attendanceRate, avgAssessmentScore: d.assessments.averagePercentage };
}
