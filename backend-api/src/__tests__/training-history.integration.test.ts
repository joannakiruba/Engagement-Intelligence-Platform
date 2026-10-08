import request from 'supertest';
import app from '../server';
import prisma from '../lib/prisma';
import { signAccessToken } from '../auth/jwt.middleware';

describe('Training History Integration Tests', () => {
  let studentId: string;
  let studentToken: string;
  let batchId: string;
  let sessionId1: string;
  let sessionId2: string;
  let assessmentId1: string;
  let windowId: string;

  beforeAll(async () => {
    // Create test role
    const studentRole = await prisma.role.upsert({
      where: { name: 'STUDENT' },
      update: {},
      create: {
        name: 'STUDENT',
        description: 'Student role',
      },
    });

    // Create permissions
    const sessionsReadOwn = await prisma.permission.upsert({
      where: { code: 'sessions:read:own' },
      update: {},
      create: {
        code: 'sessions:read:own',
        description: "Read one's own sessions",
      },
    });

    const assessmentsReadOwn = await prisma.permission.upsert({
      where: { code: 'assessments:read:own' },
      update: {},
      create: {
        code: 'assessments:read:own',
        description: "Read one's own assessment results",
      },
    });

    // Assign permissions to role
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: studentRole.id,
          permissionId: sessionsReadOwn.id,
        },
      },
      update: {},
      create: {
        roleId: studentRole.id,
        permissionId: sessionsReadOwn.id,
      },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: studentRole.id,
          permissionId: assessmentsReadOwn.id,
        },
      },
      update: {},
      create: {
        roleId: studentRole.id,
        permissionId: assessmentsReadOwn.id,
      },
    });

    // Create test student
    const student = await prisma.user.create({
      data: {
        name: 'Test Student',
        email: `student-training-history-${Date.now()}@example.com`,
        passwordHash: 'hash',
        roleId: studentRole.id,
        status: 'ACTIVE',
      },
    });
    studentId = student.id;

    // Generate token with permissions
    studentToken = signAccessToken(studentId, studentRole.id, [
      'sessions:read:own',
      'assessments:read:own',
    ]);

    // Create batch
    const batch = await prisma.batch.create({
      data: {
        name: 'Training History Test Batch',
        department: 'CSE',
        startDate: new Date('2026-09-01'),
      },
    });
    batchId = batch.id;

    // Add student to batch
    await prisma.batchMember.create({
      data: {
        batchId: batch.id,
        studentId: student.id,
      },
    });

    // Create trainer
    const trainerRole = await prisma.role.upsert({
      where: { name: 'TRAINER' },
      update: {},
      create: {
        name: 'TRAINER',
        description: 'Trainer role',
      },
    });

    const trainer = await prisma.user.create({
      data: {
        name: 'Test Trainer',
        email: `trainer-training-history-${Date.now()}@example.com`,
        passwordHash: 'hash',
        roleId: trainerRole.id,
        status: 'ACTIVE',
      },
    });

    // Create sessions
    const session1 = await prisma.session.create({
      data: {
        batchId: batch.id,
        trainerId: trainer.id,
        title: 'Advanced DSA',
        topic: 'Dynamic Programming',
        scheduledDate: new Date('2026-10-07T10:00:00.000Z'),
        startTime: new Date('2026-10-07T10:00:00.000Z'),
        endTime: new Date('2026-10-07T12:00:00.000Z'),
      },
    });
    sessionId1 = session1.id;

    const session2 = await prisma.session.create({
      data: {
        batchId: batch.id,
        trainerId: trainer.id,
        title: 'System Design',
        topic: 'Scalability Patterns',
        scheduledDate: new Date('2026-10-06T10:00:00.000Z'),
        startTime: new Date('2026-10-06T10:00:00.000Z'),
        endTime: new Date('2026-10-06T12:00:00.000Z'),
      },
    });
    sessionId2 = session2.id;

    // Create attendance window and mark attendance
    const window = await prisma.attendanceWindow.create({
      data: {
        sessionId: session1.id,
        label: 'Main Check-in',
        startTime: new Date('2026-10-07T10:00:00.000Z'),
        endTime: new Date('2026-10-07T10:15:00.000Z'),
      },
    });
    windowId = window.id;

    await prisma.attendance.create({
      data: {
        windowId: window.id,
        sessionId: session1.id,
        studentId: student.id,
        status: 'PRESENT',
      },
    });

    await prisma.attendance.create({
      data: {
        windowId: window.id,
        sessionId: session2.id,
        studentId: student.id,
        status: 'LATE',
      },
    });

    // Create assessments
    const assessment1 = await prisma.assessment.create({
      data: {
        batchId: batch.id,
        title: 'DP Assessment',
        type: 'QUIZ',
        maxScore: 100,
        assessmentDate: new Date('2026-10-07T15:00:00.000Z'),
      },
    });
    assessmentId1 = assessment1.id;

    // Create assessment result
    await prisma.assessmentResult.create({
      data: {
        assessmentId: assessment1.id,
        studentId: student.id,
        score: 86,
        remarks: 'Good work',
      },
    });

    // Create assessment without result
    await prisma.assessment.create({
      data: {
        batchId: batch.id,
        title: 'System Design Quiz',
        type: 'QUIZ',
        maxScore: 50,
        assessmentDate: new Date('2026-10-05T14:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    // Clean up in correct order to respect foreign key constraints
    await prisma.attendance.deleteMany({ where: { studentId } });
    await prisma.attendanceWindow.deleteMany({ where: { id: windowId } });
    await prisma.assessmentResult.deleteMany({ where: { studentId } });
    await prisma.assessment.deleteMany({ where: { batchId } });
    await prisma.session.deleteMany({ where: { batchId } });
    await prisma.batchMember.deleteMany({ where: { studentId } });
    await prisma.batch.deleteMany({ where: { id: batchId } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await prisma.$disconnect();
  });

  describe('GET /api/training-history', () => {
    it('should return training history for authenticated student', async () => {
      const response = await request(app)
        .get('/api/training-history')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toMatchObject({
        total: expect.any(Number),
        page: 1,
        limit: 20,
        pages: expect.any(Number),
      });

      // Should have 4 events: 2 sessions + 2 assessments
      expect(response.body.data.length).toBe(4);

      // Verify chronological order (newest first)
      const dates = response.body.data.map((e: any) => new Date(e.date).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it('should include session details and attendance', async () => {
      const response = await request(app)
        .get('/api/training-history')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const sessionEvent = response.body.data.find(
        (e: any) => e.type === 'SESSION' && e.session.title === 'Advanced DSA'
      );

      expect(sessionEvent).toMatchObject({
        type: 'SESSION',
        session: {
          id: sessionId1,
          title: 'Advanced DSA',
          topic: 'Dynamic Programming',
        },
        attendance: 'PRESENT',
      });
    });

    it('should include assessment details and score', async () => {
      const response = await request(app)
        .get('/api/training-history')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const assessmentEvent = response.body.data.find(
        (e: any) => e.type === 'ASSESSMENT' && e.assessment.title === 'DP Assessment'
      );

      expect(assessmentEvent).toMatchObject({
        type: 'ASSESSMENT',
        assessment: {
          id: assessmentId1,
          title: 'DP Assessment',
          type: 'QUIZ',
        },
        score: {
          obtained: 86,
          maximum: 100,
          percentage: 86,
        },
        remarks: 'Good work',
      });
    });

    it('should include assessment with no result', async () => {
      const response = await request(app)
        .get('/api/training-history')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const assessmentEvent = response.body.data.find(
        (e: any) => e.type === 'ASSESSMENT' && e.assessment.title === 'System Design Quiz'
      );

      expect(assessmentEvent).toMatchObject({
        type: 'ASSESSMENT',
        score: null,
        remarks: null,
      });
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/training-history?page=1&limit=2')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(2);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 4,
        pages: 2,
      });
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get('/api/training-history?from=2026-10-06&to=2026-10-07')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);

      // All events should be within date range
      response.body.data.forEach((event: any) => {
        const eventDate = new Date(event.date);
        expect(eventDate.getTime()).toBeGreaterThanOrEqual(new Date('2026-10-06').getTime());
        expect(eventDate.getTime()).toBeLessThanOrEqual(
          new Date('2026-10-07T23:59:59.999Z').getTime()
        );
      });
    });

    it('should reject unauthenticated request', async () => {
      await request(app).get('/api/training-history').expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app)
        .get('/api/training-history')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject invalid pagination params', async () => {
      await request(app)
        .get('/api/training-history?page=0')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);

      await request(app)
        .get('/api/training-history?limit=0')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);

      await request(app)
        .get('/api/training-history?limit=101')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);
    });

    it('should reject invalid date filters', async () => {
      await request(app)
        .get('/api/training-history?from=not-a-date')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);

      await request(app)
        .get('/api/training-history?to=not-a-date')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);

      await request(app)
        .get('/api/training-history?from=2026-10-01&to=2026-09-01')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400);
    });
  });
});
