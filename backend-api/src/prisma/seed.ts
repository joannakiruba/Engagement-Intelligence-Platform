import bcrypt from 'bcrypt';
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS } from './permission-catalog';
import prisma from '../lib/prisma';

const BCRYPT_ROUNDS = 10;

const TEST_USERS = [
  { name: 'Admin User', email: 'admin@hope.dev', role: 'ADMIN' },
  { name: 'Coordinator User', email: 'coordinator@hope.dev', role: 'COORDINATOR' },
  { name: 'Mentor User', email: 'mentor@hope.dev', role: 'MENTOR' },
  { name: 'Faculty User', email: 'faculty@hope.dev', role: 'FACULTY' },
  { name: 'Trainer User', email: 'trainer@hope.dev', role: 'TRAINER' },
  { name: 'Student User', email: 'student@hope.dev', role: 'STUDENT' },
] as const;

const STUDENT_NAMES = [
  'Aanya Sharma', 'Bhavya Patel', 'Charvi Reddy', 'Diya Iyer', 'Eshani Nair',
  'Fatima Khan', 'Gauri Joshi', 'Hrithika Das', 'Isha Verma', 'Jhanvi Rao',
  'Kavya Menon', 'Lavanya Gupta', 'Meera Krishnan', 'Nandini Bose', 'Oviya Sundaram',
  'Priya Malhotra', 'Riya Chauhan', 'Saanvi Pillai', 'Tanvi Agarwal', 'Uma Deshmukh',
  'Vaishnavi Hegde', 'Wafa Begum', 'Yamini Thakur', 'Zara Ali', 'Aditi Banerjee',
  'Bhoomika Shetty', 'Chitra Ranganathan', 'Deepika Venkat', 'Ekta Saxena', 'Falguni Modi',
  'Gayathri Subramanian', 'Harini Mahesh', 'Indira Kulkarni', 'Jasmine Fernandes', 'Keerthana Ravi',
  'Lakshmi Narayanan', 'Madhavi Chatterjee', 'Nithya Mohan', 'Ojaswini Patil', 'Pallavi Tripathi',
  'Radhika Srinivasan', 'Shreya Mishra', 'Tanya Kapoor', 'Urvi Mehra', 'Vidya Anand',
  'Wriddhima Sen', 'Xena Joseph', 'Yuktha Gowda', 'Zoya Ansari', 'Anushka Dutta',
];

const TRAINER_NAMES = [
  { name: 'Rajesh Kumar', email: 'rajesh.kumar@hope.dev' },
  { name: 'Priya Venkatesh', email: 'priya.venkatesh@hope.dev' },
  { name: 'Suresh Babu', email: 'suresh.babu@hope.dev' },
  { name: 'Lakshmi Priya', email: 'lakshmi.priya@hope.dev' },
];

const MENTOR_NAMES = [
  { name: 'Dr. Anand Rao', email: 'anand.rao@hope.dev' },
  { name: 'Dr. Kavitha Iyer', email: 'kavitha.iyer@hope.dev' },
  { name: 'Dr. Ramesh Nair', email: 'ramesh.nair@hope.dev' },
];

const BATCH_DEFS = [
  { name: 'Batch Alpha 2026', department: 'Computer Science', description: 'Full-stack web development track' },
  { name: 'Batch Beta 2026', department: 'Computer Science', description: 'Data science and ML track' },
  { name: 'Batch Gamma 2026', department: 'Information Technology', description: 'Cloud and DevOps track' },
  { name: 'Batch Delta 2026', department: 'Information Technology', description: 'Mobile development track' },
];

const SESSION_TOPICS = [
  { title: 'Introduction to TypeScript', topic: 'TypeScript basics, types, interfaces' },
  { title: 'React Fundamentals', topic: 'Components, props, state, hooks' },
  { title: 'Database Design', topic: 'Normalization, ERD, Prisma ORM' },
  { title: 'REST API Design', topic: 'HTTP methods, status codes, middleware' },
  { title: 'Authentication & Security', topic: 'JWT, bcrypt, RBAC patterns' },
  { title: 'Testing Strategies', topic: 'Unit tests, integration tests, mocking' },
  { title: 'Git & Collaboration', topic: 'Branching, PRs, code review' },
  { title: 'Docker Basics', topic: 'Containers, Compose, networking' },
  { title: 'CI/CD Pipelines', topic: 'GitHub Actions, deployment strategies' },
  { title: 'Performance Optimization', topic: 'Profiling, caching, query optimization' },
];

const ASSESSMENT_DEFS = [
  { title: 'TypeScript Fundamentals Quiz', type: 'QUIZ' as const },
  { title: 'React Component Assignment', type: 'ASSIGNMENT' as const },
  { title: 'Database Design Coding Test', type: 'CODING_TEST' as const },
  { title: 'API Design Contest', type: 'CONTEST' as const },
  { title: 'Security Best Practices Quiz', type: 'QUIZ' as const },
  { title: 'Full-Stack Mini Project', type: 'ASSIGNMENT' as const },
  { title: 'Algorithm Challenge', type: 'CODING_TEST' as const },
  { title: 'DevOps Pipeline Quiz', type: 'QUIZ' as const },
];

const FEEDBACK_COMMENTS = [
  'Excellent participation and engagement throughout the session.',
  'Shows good understanding but needs more practice with hands-on exercises.',
  'Very attentive and asks insightful questions.',
  'Needs improvement in time management during coding exercises.',
  'Great team player, helps other students regularly.',
  'Shows consistent improvement week over week.',
  'Could benefit from additional practice on core concepts.',
  'Outstanding problem-solving approach.',
  'Needs to be more proactive in asking questions when stuck.',
  'Strong analytical skills, applies concepts well.',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateOffset(baseDays: number): Date {
  const d = new Date('2026-09-15');
  d.setDate(d.getDate() + baseDays);
  return d;
}

function sessionTime(dayOffset: number, hour: number, minute: number): Date {
  const d = dateOffset(dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const testPassword = process.env.SEED_TEST_PASSWORD;
  if (!testPassword) {
    throw new Error(
      'SEED_TEST_PASSWORD environment variable is required. ' +
      'Set it to a development-only password (12+ chars) in your .env file.',
    );
  }

  if (testPassword.length < 12) {
    throw new Error('SEED_TEST_PASSWORD must be at least 12 characters (password policy).');
  }

  // ── Phase 1: Roles & Permissions ──

  console.log('Seeding roles...');
  const roleMap = new Map<string, string>();
  for (const roleName of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    roleMap.set(roleName, role.id);
    console.log(`  Role: ${roleName} (${role.id})`);
  }

  console.log('\nSeeding permissions...');
  const permissionMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: { code: perm.code, description: perm.description },
    });
    permissionMap.set(perm.code, permission.id);
  }
  console.log(`  ${PERMISSIONS.length} permissions upserted.`);

  console.log('\nSeeding role-permission mappings...');
  let mappingCount = 0;
  for (const [roleName, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) throw new Error(`Role ${roleName} not found.`);

    for (const code of codes) {
      const permissionId = permissionMap.get(code);
      if (!permissionId) throw new Error(`Permission "${code}" not found.`);

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
      mappingCount++;
    }
  }
  console.log(`  ${mappingCount} role-permission mappings upserted.`);

  // ── Phase 2: Test Users (original 6) ──

  console.log('\nSeeding test users...');
  const passwordHash = await bcrypt.hash(testPassword, BCRYPT_ROUNDS);
  const userIds: Record<string, string> = {};

  for (const testUser of TEST_USERS) {
    const roleId = roleMap.get(testUser.role);
    if (!roleId) throw new Error(`Role ${testUser.role} not found.`);

    const user = await prisma.user.upsert({
      where: { email: testUser.email },
      update: { name: testUser.name, roleId, passwordHash, status: 'ACTIVE' },
      create: { name: testUser.name, email: testUser.email, passwordHash, roleId, status: 'ACTIVE' },
    });
    userIds[testUser.email] = user.id;
    console.log(`  User: ${testUser.name} <${testUser.email}> role=${testUser.role}`);
  }

  // ── Phase 3: Additional Trainers ──

  console.log('\nSeeding additional trainers...');
  const trainerRoleId = roleMap.get('TRAINER')!;
  const trainerIds: string[] = [userIds['trainer@hope.dev']];

  for (const t of TRAINER_NAMES) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: { name: t.name, roleId: trainerRoleId, passwordHash, status: 'ACTIVE' },
      create: { name: t.name, email: t.email, passwordHash, roleId: trainerRoleId, status: 'ACTIVE' },
    });
    trainerIds.push(user.id);
    console.log(`  Trainer: ${t.name}`);
  }

  // ── Phase 4: Additional Mentors ──

  console.log('\nSeeding additional mentors...');
  const mentorRoleId = roleMap.get('MENTOR')!;
  const mentorIds: string[] = [userIds['mentor@hope.dev']];

  for (const m of MENTOR_NAMES) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { name: m.name, roleId: mentorRoleId, passwordHash, status: 'ACTIVE' },
      create: { name: m.name, email: m.email, passwordHash, roleId: mentorRoleId, status: 'ACTIVE' },
    });
    mentorIds.push(user.id);
    console.log(`  Mentor: ${m.name}`);
  }

  // ── Phase 5: 50 Students ──

  console.log('\nSeeding 50 students...');
  const studentRoleId = roleMap.get('STUDENT')!;
  const studentIds: string[] = [];

  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const name = STUDENT_NAMES[i];
    const email = `${name.toLowerCase().replace(/[^a-z]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/, '')}@hope.dev`;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, roleId: studentRoleId, passwordHash, status: 'ACTIVE' },
      create: {
        name,
        email,
        passwordHash,
        roleId: studentRoleId,
        status: 'ACTIVE',
        department: randomPick(['Computer Science', 'Information Technology']),
        year: randomPick([2, 3, 4]),
      },
    });
    studentIds.push(user.id);
  }
  console.log(`  ${studentIds.length} students created.`);

  // ── Phase 6: Batches ──

  console.log('\nSeeding batches...');
  const batchIds: string[] = [];

  for (let i = 0; i < BATCH_DEFS.length; i++) {
    const def = BATCH_DEFS[i];
    const batch = await prisma.batch.create({
      data: {
        name: def.name,
        department: def.department,
        description: def.description,
        startDate: dateOffset(0),
        endDate: dateOffset(21),
      },
    });
    batchIds.push(batch.id);
    console.log(`  Batch: ${def.name}`);
  }

  // ── Phase 7: Assign students & trainers to batches ──

  console.log('\nAssigning students to batches...');
  const studentsPerBatch = Math.ceil(studentIds.length / batchIds.length);

  for (let b = 0; b < batchIds.length; b++) {
    const start = b * studentsPerBatch;
    const end = Math.min(start + studentsPerBatch, studentIds.length);
    const batchStudents = studentIds.slice(start, end);

    for (const studentId of batchStudents) {
      await prisma.batchMember.upsert({
        where: { batchId_studentId: { batchId: batchIds[b], studentId } },
        update: {},
        create: { batchId: batchIds[b], studentId },
      });
    }

    const assignedTrainer = trainerIds[b % trainerIds.length];
    await prisma.batchTrainer.upsert({
      where: { batchId_trainerId: { batchId: batchIds[b], trainerId: assignedTrainer } },
      update: {},
      create: { batchId: batchIds[b], trainerId: assignedTrainer },
    });

    console.log(`  Batch ${b + 1}: ${batchStudents.length} students, 1 trainer`);
  }

  // ── Phase 8: Sessions (10 total) ──

  console.log('\nSeeding 10 sessions...');
  const sessionIds: string[] = [];
  const sessionBatchMap: Record<string, string> = {};

  for (let i = 0; i < SESSION_TOPICS.length; i++) {
    const topic = SESSION_TOPICS[i];
    const batchId = batchIds[i % batchIds.length];
    const trainerId = trainerIds[i % trainerIds.length];
    const dayOff = i + 1;

    const session = await prisma.session.create({
      data: {
        batchId,
        trainerId,
        title: topic.title,
        topic: topic.topic,
        scheduledDate: dateOffset(dayOff),
        startTime: sessionTime(dayOff, 9, 0),
        endTime: sessionTime(dayOff, 11, 0),
      },
    });
    sessionIds.push(session.id);
    sessionBatchMap[session.id] = batchId;
    console.log(`  Session: ${topic.title} (Batch ${(i % batchIds.length) + 1})`);
  }

  // ── Phase 9: Attendance (200 records) ──

  console.log('\nSeeding attendance records...');
  let attendanceCount = 0;
  const statuses: Array<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'LATE', 'ABSENT', 'EXCUSED'];

  for (const sessionId of sessionIds) {
    const batchId = sessionBatchMap[sessionId];
    const batchIndex = batchIds.indexOf(batchId);
    const start = batchIndex * studentsPerBatch;
    const end = Math.min(start + studentsPerBatch, studentIds.length);
    const batchStudents = studentIds.slice(start, end);

    for (const studentId of batchStudents) {
      if (attendanceCount >= 200) break;

      const status = randomPick(statuses);
      const checkInTime = status === 'PRESENT' || status === 'LATE'
        ? new Date(dateOffset(sessionIds.indexOf(sessionId) + 1).setHours(status === 'LATE' ? 9 : 8, randomInt(0, 59), 0, 0))
        : null;

      await prisma.attendance.upsert({
        where: { sessionId_studentId: { sessionId, studentId } },
        update: {},
        create: { sessionId, studentId, status, checkInTime },
      });
      attendanceCount++;
    }
    if (attendanceCount >= 200) break;
  }
  console.log(`  ${attendanceCount} attendance records created.`);

  // ── Phase 10: Assessments with sections, questions, and scores ──

  console.log('\nSeeding assessments...');
  let scoreCount = 0;

  for (let a = 0; a < ASSESSMENT_DEFS.length; a++) {
    const def = ASSESSMENT_DEFS[a];
    const batchId = batchIds[a % batchIds.length];
    const batchIndex = batchIds.indexOf(batchId);
    const start = batchIndex * studentsPerBatch;
    const end = Math.min(start + studentsPerBatch, studentIds.length);
    const batchStudents = studentIds.slice(start, end);

    const assessment = await prisma.assessment.create({
      data: {
        batchId,
        title: def.title,
        type: def.type,
        maxScore: 100,
        assessmentDate: dateOffset(a + 2),
      },
    });

    const section = await prisma.assessmentSection.create({
      data: {
        assessmentId: assessment.id,
        title: 'Main Section',
        sortOrder: 0,
        weightage: 100,
      },
    });

    const questionIds: string[] = [];
    const qCount = randomInt(3, 5);
    const scorePerQ = Math.floor(100 / qCount);

    for (let q = 0; q < qCount; q++) {
      const question = await prisma.assessmentQuestion.create({
        data: {
          sectionId: section.id,
          label: `Question ${q + 1}`,
          maxScore: q === qCount - 1 ? 100 - scorePerQ * (qCount - 1) : scorePerQ,
          sortOrder: q,
        },
      });
      questionIds.push(question.id);
    }

    const maxStudentsPerAssessment = Math.min(batchStudents.length, Math.ceil(100 / ASSESSMENT_DEFS.length));

    for (let s = 0; s < maxStudentsPerAssessment && scoreCount < 100; s++) {
      const studentId = batchStudents[s];
      let totalScore = 0;

      for (const questionId of questionIds) {
        const question = await prisma.assessmentQuestion.findUnique({ where: { id: questionId } });
        const score = Math.round(randomInt(40, 100) / 100 * question!.maxScore * 100) / 100;
        totalScore += score;

        await prisma.studentQuestionScore.upsert({
          where: { questionId_studentId: { questionId, studentId } },
          update: { score },
          create: { questionId, studentId, score },
        });
      }

      await prisma.assessmentResult.upsert({
        where: { assessmentId_studentId: { assessmentId: assessment.id, studentId } },
        update: { score: Math.round(totalScore * 100) / 100 },
        create: {
          assessmentId: assessment.id,
          studentId,
          score: Math.round(totalScore * 100) / 100,
        },
      });
      scoreCount++;
    }

    console.log(`  Assessment: ${def.title} (${questionIds.length} questions, ${Math.min(maxStudentsPerAssessment, 100 - scoreCount + maxStudentsPerAssessment)} scored)`);
  }
  console.log(`  ${scoreCount} total assessment results created.`);

  // ── Phase 11: Feedback (50 entries) ──

  console.log('\nSeeding feedback...');
  let feedbackCount = 0;

  for (const sessionId of sessionIds) {
    const batchId = sessionBatchMap[sessionId];
    const batchIndex = batchIds.indexOf(batchId);
    const trainerId = trainerIds[batchIndex % trainerIds.length];
    const start = batchIndex * studentsPerBatch;
    const end = Math.min(start + studentsPerBatch, studentIds.length);
    const batchStudents = studentIds.slice(start, end);

    for (const studentId of batchStudents) {
      if (feedbackCount >= 50) break;

      await prisma.feedback.create({
        data: {
          sessionId,
          studentId,
          trainerId,
          effortRating: randomInt(2, 5),
          participationRating: randomInt(2, 5),
          comments: randomPick(FEEDBACK_COMMENTS),
        },
      });
      feedbackCount++;
    }
    if (feedbackCount >= 50) break;
  }
  console.log(`  ${feedbackCount} feedback records created.`);

  // ── Phase 12: Mentor Assignments ──

  console.log('\nSeeding mentor assignments...');
  const studentsPerMentor = Math.ceil(studentIds.length / mentorIds.length);

  for (let m = 0; m < mentorIds.length; m++) {
    const start = m * studentsPerMentor;
    const end = Math.min(start + studentsPerMentor, studentIds.length);

    for (let s = start; s < end; s++) {
      await prisma.mentorAssignment.upsert({
        where: { mentorId_studentId: { mentorId: mentorIds[m], studentId: studentIds[s] } },
        update: {},
        create: { mentorId: mentorIds[m], studentId: studentIds[s] },
      });
    }
    console.log(`  Mentor ${m + 1}: ${end - start} students assigned`);
  }

  console.log('\nSeed completed successfully.');
  console.log(`  Summary: ${studentIds.length} students, ${batchIds.length} batches, ${sessionIds.length} sessions, ${attendanceCount} attendance, ${scoreCount} assessment results, ${feedbackCount} feedback, ${mentorIds.length} mentors with assignments`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
