/**
 * Frontend ↔ Backend connectivity tests
 *
 * Verifies every frontend service function calls the correct
 * HTTP method + URL path + payload shape that the backend routes expect.
 * Mocks axios so no real server is needed.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock axios ──────────────────────────────────────────────
const mockAxiosInstance = {
  get: vi.fn().mockResolvedValue({ data: { data: {} } }),
  post: vi.fn().mockResolvedValue({ data: { data: {} } }),
  put: vi.fn().mockResolvedValue({ data: { data: {} } }),
  patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
  delete: vi.fn().mockResolvedValue({ data: { data: {} } }),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

vi.mock('axios', () => ({
  default: {
    create: () => mockAxiosInstance,
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
}));

// ── Helpers ──────────────────────────────────────────────────

function expectGet(url: string) {
  expect(mockAxiosInstance.get).toHaveBeenCalledWith(
    url,
    expect.anything ? expect.anything() : undefined,
  );
}

function expectGetExact(url: string) {
  const calls = mockAxiosInstance.get.mock.calls;
  const match = calls.some((c: any[]) => c[0] === url);
  expect(match).toBe(true);
}

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID2 = 'b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22';

beforeEach(() => {
  vi.clearAllMocks();
  mockAxiosInstance.get.mockResolvedValue({ data: { data: [] } });
  mockAxiosInstance.post.mockResolvedValue({ data: { data: {} } });
  mockAxiosInstance.put.mockResolvedValue({ data: { data: {} } });
  mockAxiosInstance.patch.mockResolvedValue({ data: { data: {} } });
  mockAxiosInstance.delete.mockResolvedValue({ data: { data: {} } });
});

// ═══════════════════════════════════════════════════════════════
// ATTENDANCE SERVICE  →  /api/attendance/*
// Backend mount: app.use('/api/attendance', attendanceRoutes)
// ═══════════════════════════════════════════════════════════════
describe('Attendance Service → Backend Routes', () => {
  it('createWindow → POST /api/attendance/windows', async () => {
    const { createWindow } = await import('../services/attendance.service');
    await createWindow({ sessionId: UUID, label: 'AM', startTime: '2026-10-06T08:00:00Z', endTime: '2026-10-06T08:15:00Z' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/attendance/windows',
      expect.objectContaining({ sessionId: UUID, label: 'AM' }),
    );
  });

  it('getSessionWindows → GET /api/attendance/session/:sessionId/windows', async () => {
    const { getSessionWindows } = await import('../services/attendance.service');
    await getSessionWindows(UUID);
    expectGetExact(`/api/attendance/session/${UUID}/windows`);
  });

  it('getWindowAttendance → GET /api/attendance/window/:windowId', async () => {
    const { getWindowAttendance } = await import('../services/attendance.service');
    await getWindowAttendance(UUID);
    expectGetExact(`/api/attendance/window/${UUID}`);
  });

  it('getSessionAttendance → GET /api/attendance/session/:sessionId', async () => {
    const { getSessionAttendance } = await import('../services/attendance.service');
    await getSessionAttendance(UUID);
    expectGetExact(`/api/attendance/session/${UUID}`);
  });

  it('markAttendance → POST /api/attendance/mark', async () => {
    const { markAttendance } = await import('../services/attendance.service');
    await markAttendance(UUID, UUID2, 'PRESENT', 'On time');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/attendance/mark',
      expect.objectContaining({ windowId: UUID, studentId: UUID2, status: 'PRESENT' }),
    );
  });

  it('bulkMarkAttendance → POST /api/attendance/bulk', async () => {
    const { bulkMarkAttendance } = await import('../services/attendance.service');
    await bulkMarkAttendance(UUID, [{ studentId: UUID2, status: 'PRESENT' }]);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/attendance/bulk',
      expect.objectContaining({ windowId: UUID }),
    );
  });

  it('updateAttendance → PUT /api/attendance/:id', async () => {
    const { updateAttendance } = await import('../services/attendance.service');
    await updateAttendance(UUID, { status: 'EXCUSED' });
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      `/api/attendance/${UUID}`,
      expect.objectContaining({ status: 'EXCUSED' }),
    );
  });

  it('getStudentAttendance → GET /api/attendance/student/:studentId', async () => {
    const { getStudentAttendance } = await import('../services/attendance.service');
    await getStudentAttendance(UUID, { batchId: UUID2 });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      `/api/attendance/student/${UUID}`,
      expect.objectContaining({ params: { batchId: UUID2 } }),
    );
  });

  it('getBatchAttendanceStats → GET /api/attendance/batch/:batchId/stats', async () => {
    const { getBatchAttendanceStats } = await import('../services/attendance.service');
    await getBatchAttendanceStats(UUID);
    expectGetExact(`/api/attendance/batch/${UUID}/stats`);
  });

  it('exportSessionCsv → GET /api/attendance/session/:sessionId/export', async () => {
    const { exportSessionCsv } = await import('../services/attendance.service');
    await exportSessionCsv(UUID);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      `/api/attendance/session/${UUID}/export`,
      expect.objectContaining({ responseType: 'blob' }),
    );
  });

  it('getWindowQR → GET /api/attendance/window/:windowId/qr', async () => {
    const { getWindowQR } = await import('../services/attendance.service');
    await getWindowQR(UUID);
    expectGetExact(`/api/attendance/window/${UUID}/qr`);
  });

  it('getExcusedRecords → GET /api/attendance/excused', async () => {
    const { getExcusedRecords } = await import('../services/attendance.service');
    await getExcusedRecords({ batchId: UUID });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/api/attendance/excused',
      expect.objectContaining({ params: { batchId: UUID } }),
    );
  });

  it('studentCheckIn → POST /api/attendance/check-in with qrToken', async () => {
    const { studentCheckIn } = await import('../services/attendance.service');
    await studentCheckIn(UUID, 'abc12345');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/attendance/check-in',
      expect.objectContaining({ windowId: UUID, qrToken: 'abc12345' }),
    );
  });

  it('studentCheckIn passes bssid/ssid extra fields', async () => {
    const { studentCheckIn } = await import('../services/attendance.service');
    await studentCheckIn(UUID, 'tok', { bssid: 'AA:BB:CC:DD:EE:FF', ssid: 'CampusWiFi' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/attendance/check-in',
      expect.objectContaining({ bssid: 'AA:BB:CC:DD:EE:FF', ssid: 'CampusWiFi' }),
    );
  });

  it('getAttendanceFlags → GET /api/attendance/flags', async () => {
    const { getAttendanceFlags } = await import('../services/attendance.service');
    await getAttendanceFlags({ status: 'PENDING' });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/api/attendance/flags',
      expect.objectContaining({ params: { status: 'PENDING' } }),
    );
  });

  it('resolveAttendanceFlag → PUT /api/attendance/flags/:id', async () => {
    const { resolveAttendanceFlag } = await import('../services/attendance.service');
    await resolveAttendanceFlag('flag-1', 'CONFIRMED_FRAUD');
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      '/api/attendance/flags/flag-1',
      { status: 'CONFIRMED_FRAUD' },
    );
  });

  it('getAttendanceFlagStats → GET /api/attendance/flags/stats', async () => {
    const { getAttendanceFlagStats } = await import('../services/attendance.service');
    await getAttendanceFlagStats();
    expectGetExact('/api/attendance/flags/stats');
  });

  it('exports alias getExcusedAttendance', async () => {
    const { getExcusedAttendance } = await import('../services/attendance.service');
    expect(typeof getExcusedAttendance).toBe('function');
  });

  it('exports alias checkInStudent', async () => {
    const { checkInStudent } = await import('../services/attendance.service');
    expect(typeof checkInStudent).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════
// ASSESSMENTS SERVICE  →  /api/assessments/*
// ═══════════════════════════════════════════════════════════════
describe('Assessments Service → Backend Routes', () => {
  it('getAssessments → GET /api/assessments', async () => {
    const { getAssessments } = await import('../services/assessments.service');
    await getAssessments({ batchId: UUID });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/api/assessments',
      expect.objectContaining({ params: { batchId: UUID } }),
    );
  });

  it('getAssessment → GET /api/assessments/:id', async () => {
    const { getAssessment } = await import('../services/assessments.service');
    await getAssessment(UUID);
    expectGetExact(`/api/assessments/${UUID}`);
  });

  it('createAssessment → POST /api/assessments', async () => {
    const { createAssessment } = await import('../services/assessments.service');
    const payload = { batchId: UUID, title: 'Quiz 1', type: 'QUIZ' as const, assessmentDate: '2026-10-06' };
    await createAssessment(payload);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/assessments',
      expect.objectContaining({ title: 'Quiz 1' }),
    );
  });

  it('updateAssessment → PUT /api/assessments/:id', async () => {
    const { updateAssessment } = await import('../services/assessments.service');
    await updateAssessment(UUID, { title: 'Updated' });
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      `/api/assessments/${UUID}`,
      expect.objectContaining({ title: 'Updated' }),
    );
  });

  it('deleteAssessment → DELETE /api/assessments/:id', async () => {
    const { deleteAssessment } = await import('../services/assessments.service');
    await deleteAssessment(UUID);
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/assessments/${UUID}`);
  });

  it('submitQuestionScores → POST /api/assessments/:id/scores', async () => {
    const { submitQuestionScores } = await import('../services/assessments.service');
    await submitQuestionScores(UUID, { studentId: UUID2, questionScores: [{ questionId: 'q1', score: 8 }] });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      `/api/assessments/${UUID}/scores`,
      expect.objectContaining({ studentId: UUID2 }),
    );
  });

  it('getResults → GET /api/assessments/:id/results', async () => {
    const { getResults } = await import('../services/assessments.service');
    await getResults(UUID);
    expectGetExact(`/api/assessments/${UUID}/results`);
  });

  it('getStudentResult → GET /api/assessments/:id/results/:studentId', async () => {
    const { getStudentResult } = await import('../services/assessments.service');
    await getStudentResult(UUID, UUID2);
    expectGetExact(`/api/assessments/${UUID}/results/${UUID2}`);
  });

  it('exports getAssessmentResults alias', async () => {
    const { getAssessmentResults } = await import('../services/assessments.service');
    expect(typeof getAssessmentResults).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════
// BATCHES SERVICE  →  /api/batches/*
// ═══════════════════════════════════════════════════════════════
describe('Batches Service → Backend Routes', () => {
  it('getBatches → GET /api/batches', async () => {
    const { getBatches } = await import('../services/batches.service');
    await getBatches();
    expectGetExact('/api/batches');
  });

  it('getBatch → GET /api/batches/:id', async () => {
    const { getBatch } = await import('../services/batches.service');
    await getBatch(UUID);
    expectGetExact(`/api/batches/${UUID}`);
  });

  it('createBatch → POST /api/batches', async () => {
    const { createBatch } = await import('../services/batches.service');
    await createBatch({ name: 'Batch A', department: 'CS', startDate: '2026-10-01' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/batches',
      expect.objectContaining({ name: 'Batch A' }),
    );
  });

  it('updateBatch → PUT /api/batches/:id', async () => {
    const { updateBatch } = await import('../services/batches.service');
    await updateBatch(UUID, { name: 'Updated' });
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      `/api/batches/${UUID}`,
      expect.objectContaining({ name: 'Updated' }),
    );
  });

  it('deleteBatch → DELETE /api/batches/:id', async () => {
    const { deleteBatch } = await import('../services/batches.service');
    await deleteBatch(UUID);
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/batches/${UUID}`);
  });

  it('getRoster → GET /api/batches/:id/roster', async () => {
    const { getRoster } = await import('../services/batches.service');
    await getRoster(UUID);
    expectGetExact(`/api/batches/${UUID}/roster`);
  });

  it('addStudent → POST /api/batches/:id/students', async () => {
    const { addStudent } = await import('../services/batches.service');
    await addStudent(UUID, UUID2);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      `/api/batches/${UUID}/students`,
      { studentId: UUID2 },
    );
  });

  it('removeStudent → DELETE /api/batches/:id/students/:studentId', async () => {
    const { removeStudent } = await import('../services/batches.service');
    await removeStudent(UUID, UUID2);
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/batches/${UUID}/students/${UUID2}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// FEEDBACK SERVICE  →  /api/feedback/*
// ═══════════════════════════════════════════════════════════════
describe('Feedback Service → Backend Routes', () => {
  it('getFeedbackList → GET /api/feedback?sessionId=...', async () => {
    const { getFeedbackList } = await import('../services/feedback.service');
    await getFeedbackList({ sessionId: UUID });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      expect.stringContaining(`/api/feedback?sessionId=${UUID}`),
    );
  });

  it('getFeedback → GET /api/feedback/:id', async () => {
    const { getFeedback } = await import('../services/feedback.service');
    await getFeedback(UUID);
    expectGetExact(`/api/feedback/${UUID}`);
  });

  it('createFeedback → POST /api/feedback', async () => {
    const { createFeedback } = await import('../services/feedback.service');
    await createFeedback({ sessionId: UUID, studentId: UUID2, effortRating: 4, participationRating: 3 });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/feedback',
      expect.objectContaining({ sessionId: UUID }),
    );
  });

  it('updateFeedback → PUT /api/feedback/:id', async () => {
    const { updateFeedback } = await import('../services/feedback.service');
    await updateFeedback(UUID, { effortRating: 5 });
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      `/api/feedback/${UUID}`,
      expect.objectContaining({ effortRating: 5 }),
    );
  });

  it('deleteFeedback → DELETE /api/feedback/:id', async () => {
    const { deleteFeedback } = await import('../services/feedback.service');
    await deleteFeedback(UUID);
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/feedback/${UUID}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT SERVICE  →  /api/engagement/*
// ═══════════════════════════════════════════════════════════════
describe('Engagement Service → Backend Routes', () => {
  it('getEngagementDashboard → GET /api/engagement/dashboard', async () => {
    const { getEngagementDashboard } = await import('../services/engagement.service');
    await getEngagementDashboard();
    expectGetExact('/api/engagement/dashboard');
  });

  it('getBatchEngagement → GET /api/engagement/batch/:batchId', async () => {
    const { getBatchEngagement } = await import('../services/engagement.service');
    await getBatchEngagement(UUID);
    expectGetExact(`/api/engagement/batch/${UUID}`);
  });

  it('getBatchTrends → GET /api/engagement/batch/:batchId/trends', async () => {
    const { getBatchTrends } = await import('../services/engagement.service');
    await getBatchTrends(UUID);
    expectGetExact(`/api/engagement/batch/${UUID}/trends`);
  });

  it('getStudentEngagement → GET /api/engagement/student/:studentId', async () => {
    const { getStudentEngagement } = await import('../services/engagement.service');
    await getStudentEngagement(UUID);
    expectGetExact(`/api/engagement/student/${UUID}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// EVENTS SERVICE  →  /api/events/*
// ═══════════════════════════════════════════════════════════════
describe('Events Service → Backend Routes', () => {
  it('getEvents → GET /api/events', async () => {
    const { getEvents } = await import('../services/events.service');
    await getEvents();
    expectGetExact('/api/events');
  });

  it('getEvent → GET /api/events/:id', async () => {
    const { getEvent } = await import('../services/events.service');
    await getEvent(UUID);
    expectGetExact(`/api/events/${UUID}`);
  });

  it('createEvent → POST /api/events', async () => {
    const { createEvent } = await import('../services/events.service');
    await createEvent({ title: 'Hackathon', eventType: 'HACKATHON', eventDate: '2026-11-01' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({ title: 'Hackathon' }),
    );
  });

  it('updateEvent → PUT /api/events/:id', async () => {
    const { updateEvent } = await import('../services/events.service');
    await updateEvent(UUID, { title: 'Updated Hackathon' });
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      `/api/events/${UUID}`,
      expect.objectContaining({ title: 'Updated Hackathon' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// EVENT REGISTRATIONS SERVICE  →  /api/event-registrations/*
// ═══════════════════════════════════════════════════════════════
describe('Event Registrations Service → Backend Routes', () => {
  it('registerForEvent → POST /api/event-registrations', async () => {
    const { registerForEvent } = await import('../services/event-registrations.service');
    await registerForEvent(UUID);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/event-registrations',
      { eventId: UUID },
    );
  });

  it('getMyRegistrations → GET /api/event-registrations/my', async () => {
    const { getMyRegistrations } = await import('../services/event-registrations.service');
    await getMyRegistrations();
    expectGetExact('/api/event-registrations/my');
  });

  it('getAllRegistrations → GET /api/event-registrations', async () => {
    const { getAllRegistrations } = await import('../services/event-registrations.service');
    await getAllRegistrations();
    expectGetExact('/api/event-registrations');
  });

  it('cancelRegistration → DELETE /api/event-registrations/:id', async () => {
    const { cancelRegistration } = await import('../services/event-registrations.service');
    await cancelRegistration(UUID);
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/event-registrations/${UUID}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// RISK SERVICE  →  /api/risk/*
// ═══════════════════════════════════════════════════════════════
describe('Risk Service → Backend Routes', () => {
  it('getHighRiskStudents → GET /api/risk/high', async () => {
    const { getHighRiskStudents } = await import('../services/risk.service');
    await getHighRiskStudents();
    expectGetExact('/api/risk/high');
  });

  it('getStudentRisk → GET /api/risk/student/:studentId', async () => {
    const { getStudentRisk } = await import('../services/risk.service');
    await getStudentRisk(UUID);
    expectGetExact(`/api/risk/student/${UUID}`);
  });

  it('getStudentRiskHistory → GET /api/risk/student/:studentId/history', async () => {
    const { getStudentRiskHistory } = await import('../services/risk.service');
    await getStudentRiskHistory(UUID);
    expectGetExact(`/api/risk/student/${UUID}/history`);
  });

  it('calculateStudentRisk → POST /api/risk/calculate/:studentId with batchId', async () => {
    const { calculateStudentRisk } = await import('../services/risk.service');
    await calculateStudentRisk(UUID, UUID2);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      `/api/risk/calculate/${UUID}`,
      { batchId: UUID2 },
    );
  });

  it('calculateBatchRisk → POST /api/risk/calculate/batch/:batchId', async () => {
    const { calculateBatchRisk } = await import('../services/risk.service');
    await calculateBatchRisk(UUID);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(`/api/risk/calculate/batch/${UUID}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// MENTOR SERVICE  →  /api/mentor-assignments/* & /api/mentor-alerts/*
// ═══════════════════════════════════════════════════════════════
describe('Mentor Service → Backend Routes', () => {
  it('getMentorAssignments → GET /api/mentor-assignments', async () => {
    const { getMentorAssignments } = await import('../services/mentor.service');
    await getMentorAssignments({ mentorId: UUID });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/api/mentor-assignments',
      expect.objectContaining({ params: { mentorId: UUID } }),
    );
  });

  it('createMentorAssignment → POST /api/mentor-assignments', async () => {
    const { createMentorAssignment } = await import('../services/mentor.service');
    await createMentorAssignment(UUID, UUID2);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/mentor-assignments',
      { mentorId: UUID, studentId: UUID2 },
    );
  });

  it('deleteMentorAssignment → DELETE /api/mentor-assignments/:id', async () => {
    const { deleteMentorAssignment } = await import('../services/mentor.service');
    await deleteMentorAssignment(UUID);
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/mentor-assignments/${UUID}`);
  });

  it('getMentorAlerts → GET /api/mentor-alerts/mentor/:mentorId', async () => {
    const { getMentorAlerts } = await import('../services/mentor.service');
    await getMentorAlerts(UUID);
    expectGetExact(`/api/mentor-alerts/mentor/${UUID}`);
  });

  it('getStudentAlerts → GET /api/mentor-alerts/student/:studentId', async () => {
    const { getStudentAlerts } = await import('../services/mentor.service');
    await getStudentAlerts(UUID);
    expectGetExact(`/api/mentor-alerts/student/${UUID}`);
  });

  it('getAlertStats → GET /api/mentor-alerts/stats', async () => {
    const { getAlertStats } = await import('../services/mentor.service');
    await getAlertStats();
    expectGetExact('/api/mentor-alerts/stats');
  });

  it('updateAlertStatus → PUT /api/mentor-alerts/:alertId/status', async () => {
    const { updateAlertStatus } = await import('../services/mentor.service');
    await updateAlertStatus(42, 'acted');
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      '/api/mentor-alerts/42/status',
      { status: 'acted' },
    );
  });

  it('recordAlertOutcome → POST /api/mentor-alerts/:alertId/outcome', async () => {
    const { recordAlertOutcome } = await import('../services/mentor.service');
    await recordAlertOutcome(42, {
      mentor_response: 'acted',
      was_recommendation_followed: true,
    });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/mentor-alerts/42/outcome',
      expect.objectContaining({ mentor_response: 'acted' }),
    );
  });

  it('generateAlerts → POST /api/mentor-alerts/generate', async () => {
    const { generateAlerts } = await import('../services/mentor.service');
    await generateAlerts(UUID);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/mentor-alerts/generate',
      { batchId: UUID },
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS SERVICE  →  /api/notifications/*
// ═══════════════════════════════════════════════════════════════
describe('Notifications Service → Backend Routes', () => {
  it('getNotifications → GET /api/notifications', async () => {
    const { getNotifications } = await import('../services/notifications.service');
    await getNotifications(1, 20);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/api/notifications',
      expect.objectContaining({ params: { page: 1, limit: 20 } }),
    );
  });

  it('markAsRead → PATCH /api/notifications/:id/read', async () => {
    const { markAsRead } = await import('../services/notifications.service');
    await markAsRead(UUID);
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(`/api/notifications/${UUID}/read`);
  });

  it('markAllAsRead → POST /api/notifications/mark-all-read', async () => {
    const { markAllAsRead } = await import('../services/notifications.service');
    await markAllAsRead();
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/notifications/mark-all-read');
  });
});

// ═══════════════════════════════════════════════════════════════
// TASKS SERVICE  →  /api/tasks/*
// ═══════════════════════════════════════════════════════════════
describe('Tasks Service → Backend Routes', () => {
  it('getTasks → GET /api/tasks', async () => {
    const { getTasks } = await import('../services/tasks.service');
    await getTasks();
    expectGetExact('/api/tasks');
  });

  it('getMyTasks → GET /api/tasks/my-tasks', async () => {
    const { getMyTasks } = await import('../services/tasks.service');
    await getMyTasks();
    expectGetExact('/api/tasks/my-tasks');
  });

  it('getTask → GET /api/tasks/:id', async () => {
    const { getTask } = await import('../services/tasks.service');
    await getTask(UUID);
    expectGetExact(`/api/tasks/${UUID}`);
  });

  it('createTask → POST /api/tasks', async () => {
    const { createTask } = await import('../services/tasks.service');
    await createTask({ title: 'Read chapter 5', isMandatory: true, batchIds: [UUID] });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({ title: 'Read chapter 5', batchIds: [UUID] }),
    );
  });

  it('updateTask → PUT /api/tasks/:id', async () => {
    const { updateTask } = await import('../services/tasks.service');
    await updateTask(UUID, { title: 'Updated' });
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      `/api/tasks/${UUID}`,
      expect.objectContaining({ title: 'Updated' }),
    );
  });

  it('deleteTask → DELETE /api/tasks/:id', async () => {
    const { deleteTask } = await import('../services/tasks.service');
    await deleteTask(UUID);
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/tasks/${UUID}`);
  });

  it('updateTaskProgress → PATCH /api/tasks/:id/progress', async () => {
    const { updateTaskProgress } = await import('../services/tasks.service');
    await updateTaskProgress(UUID, { progress: 'COMPLETED' });
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
      `/api/tasks/${UUID}/progress`,
      expect.objectContaining({ progress: 'COMPLETED' }),
    );
  });

  it('setTaskMarks → PUT /api/tasks/:id/marks', async () => {
    const { setTaskMarks } = await import('../services/tasks.service');
    await setTaskMarks(UUID, UUID2, 85);
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      `/api/tasks/${UUID}/marks`,
      { studentId: UUID2, marksAwarded: 85 },
    );
  });

  it('changeDeadline → PATCH /api/tasks/:id/deadline', async () => {
    const { changeDeadline } = await import('../services/tasks.service');
    await changeDeadline(UUID, { deadlineType: 'FIXED', deadline: '2026-12-01T00:00:00Z' });
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
      `/api/tasks/${UUID}/deadline`,
      expect.objectContaining({ deadlineType: 'FIXED' }),
    );
  });

  it('closeTask → POST /api/tasks/:id/close', async () => {
    const { closeTask } = await import('../services/tasks.service');
    await closeTask(UUID);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(`/api/tasks/${UUID}/close`);
  });

  it('reopenTask → POST /api/tasks/:id/reopen', async () => {
    const { reopenTask } = await import('../services/tasks.service');
    await reopenTask(UUID);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(`/api/tasks/${UUID}/reopen`);
  });

  it('toggleInterested → POST /api/tasks/:id/interested', async () => {
    const { toggleInterested } = await import('../services/tasks.service');
    await toggleInterested(UUID);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(`/api/tasks/${UUID}/interested`);
  });
});

// ═══════════════════════════════════════════════════════════════
// PROOFS SERVICE  →  /api/proofs/*
// ═══════════════════════════════════════════════════════════════
describe('Proofs Service → Backend Routes', () => {
  it('getProofs → GET /api/proofs', async () => {
    const { getProofs } = await import('../services/proofs.service');
    await getProofs();
    expectGetExact('/api/proofs');
  });

  it('getMyProofs → GET /api/proofs/my', async () => {
    const { getMyProofs } = await import('../services/proofs.service');
    await getMyProofs();
    expectGetExact('/api/proofs/my');
  });

  it('submitProof → POST /api/proofs (FormData)', async () => {
    const { submitProof } = await import('../services/proofs.service');
    const file = new File(['test'], 'cert.pdf', { type: 'application/pdf' });
    await submitProof(UUID, file);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/proofs',
      expect.any(FormData),
    );
  });

  it('getProofDetail → GET /api/proofs/:id', async () => {
    const { getProofDetail } = await import('../services/proofs.service');
    await getProofDetail(UUID);
    expectGetExact(`/api/proofs/${UUID}`);
  });

  it('replaceProofFile → PUT /api/proofs/:id/file (FormData)', async () => {
    const { replaceProofFile } = await import('../services/proofs.service');
    const file = new File(['test'], 'cert2.pdf', { type: 'application/pdf' });
    await replaceProofFile(UUID, file);
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      `/api/proofs/${UUID}/file`,
      expect.any(FormData),
    );
  });

  it('reviewProof → PATCH /api/proofs/:id/review', async () => {
    const { reviewProof } = await import('../services/proofs.service');
    await reviewProof(UUID, 'APPROVED', 'Looks good');
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
      `/api/proofs/${UUID}/review`,
      { status: 'APPROVED', remarks: 'Looks good' },
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// LEADERBOARD SERVICE  →  /api/leaderboard/*
// ═══════════════════════════════════════════════════════════════
describe('Leaderboard Service → Backend Routes', () => {
  it('getBatchLeaderboard → GET /api/leaderboard/batch/:batchId', async () => {
    const { getBatchLeaderboard } = await import('../services/leaderboard.service');
    await getBatchLeaderboard(UUID, '2026-W40');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      `/api/leaderboard/batch/${UUID}`,
      expect.objectContaining({ params: { week: '2026-W40' } }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// INTERVENTIONS SERVICE  →  /api/interventions/*
// ═══════════════════════════════════════════════════════════════
describe('Interventions Service → Backend Routes', () => {
  it('getInterventions → GET /api/interventions', async () => {
    const { getInterventions } = await import('../services/interventions.service');
    await getInterventions({ status: 'PENDING' });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      '/api/interventions',
      expect.objectContaining({ params: { status: 'PENDING' } }),
    );
  });

  it('getIntervention → GET /api/interventions/:id', async () => {
    const { getIntervention } = await import('../services/interventions.service');
    await getIntervention(UUID);
    expectGetExact(`/api/interventions/${UUID}`);
  });

  it('createIntervention → POST /api/interventions', async () => {
    const { createIntervention } = await import('../services/interventions.service');
    await createIntervention({ studentId: UUID, title: 'Check-in', description: 'Weekly' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/interventions',
      expect.objectContaining({ studentId: UUID, title: 'Check-in' }),
    );
  });

  it('updateIntervention → PUT /api/interventions/:id', async () => {
    const { updateIntervention } = await import('../services/interventions.service');
    await updateIntervention(UUID, { status: 'COMPLETED' });
    expect(mockAxiosInstance.put).toHaveBeenCalledWith(
      `/api/interventions/${UUID}`,
      expect.objectContaining({ status: 'COMPLETED' }),
    );
  });

  it('addInterventionNote → POST /api/interventions/:id/updates', async () => {
    const { addInterventionNote } = await import('../services/interventions.service');
    await addInterventionNote(UUID, 'Student showed improvement');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      `/api/interventions/${UUID}/updates`,
      { note: 'Student showed improvement' },
    );
  });

  it('logInterventionOutcome → POST /api/interventions/:id/outcome', async () => {
    const { logInterventionOutcome } = await import('../services/interventions.service');
    await logInterventionOutcome(UUID, { outcome: 'IMPROVED', remarks: 'Good progress' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      `/api/interventions/${UUID}/outcome`,
      expect.objectContaining({ outcome: 'IMPROVED' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// USERS SERVICE  →  /users/*
// ═══════════════════════════════════════════════════════════════
describe('Users Service → Backend Routes', () => {
  it('getMe → GET /users/me', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: { data: { id: '1', name: 'Test', email: 'a@b.c', role: 'STUDENT', status: 'ACTIVE' } } });
    const { getMe } = await import('../services/users.service');
    await getMe();
    expectGetExact('/users/me');
  });

  it('updateMe → PATCH /users/me', async () => {
    mockAxiosInstance.patch.mockResolvedValue({ data: { data: { id: '1', name: 'Updated', email: 'a@b.c', role: 'STUDENT', status: 'ACTIVE' } } });
    const { updateMe } = await import('../services/users.service');
    await updateMe({ name: 'Updated' });
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
      '/users/me',
      expect.objectContaining({ name: 'Updated' }),
    );
  });

  it('getUsers → GET /users', async () => {
    const { getUsers } = await import('../services/users.service');
    await getUsers();
    expectGetExact('/users');
  });

  it('getUser → GET /users/:id', async () => {
    const { getUser } = await import('../services/users.service');
    await getUser(UUID);
    expectGetExact(`/users/${UUID}`);
  });

  it('createUser → POST /users', async () => {
    const { createUser } = await import('../services/users.service');
    await createUser({ name: 'Alice', email: 'alice@test.com' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/users',
      expect.objectContaining({ name: 'Alice' }),
    );
  });

  it('changeUserRole → PATCH /users/:id/role', async () => {
    const { changeUserRole } = await import('../services/users.service');
    await changeUserRole(UUID, 'TRAINER');
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
      `/users/${UUID}/role`,
      expect.objectContaining({}),
    );
  });

  it('changeUserStatus → PATCH /users/:id/status', async () => {
    const { changeUserStatus } = await import('../services/users.service');
    await changeUserStatus(UUID, 'ACTIVE');
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
      `/users/${UUID}/status`,
      { status: 'ACTIVE' },
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// API CLIENT — Token & Error Handling
// ═══════════════════════════════════════════════════════════════
describe('API Client', () => {
  it('setAccessToken / getAccessToken round-trips', async () => {
    const { setAccessToken, getAccessToken } = await import('../services/api');
    setAccessToken('test-token');
    expect(getAccessToken()).toBe('test-token');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it('getErrorMessage extracts from response.data.error', async () => {
    const { getErrorMessage } = await import('../services/api');
    const err = { response: { data: { error: 'Not found' } } };
    expect(getErrorMessage(err)).toBe('Not found');
  });

  it('getErrorMessage extracts from response.data.message', async () => {
    const { getErrorMessage } = await import('../services/api');
    const err = { response: { data: { message: 'Server error' } } };
    expect(getErrorMessage(err)).toBe('Server error');
  });

  it('getErrorMessage falls back to err.message', async () => {
    const { getErrorMessage } = await import('../services/api');
    expect(getErrorMessage(new Error('oops'))).toBe('oops');
  });

  it('getErrorMessage returns default for unknown', async () => {
    const { getErrorMessage } = await import('../services/api');
    expect(getErrorMessage({})).toBe('An unexpected error occurred. Please try again.');
  });
});
