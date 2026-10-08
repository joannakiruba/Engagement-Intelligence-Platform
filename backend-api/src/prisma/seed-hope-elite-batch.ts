/**
 * Seed HOPE Elite 2028 Batch with all students from Names.csv
 * Create mentor Karthi M and assign to all students
 */

import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';

const SEED_PASSWORD = process.env.SEED_TEST_PASSWORD || 'HopeTest2026!@dev';

// All student emails from Names.csv
const STUDENT_EMAILS = [
  'akash.m@hope.dev',
  'jeevan.kingslee@hope.dev',
  'santhosh.s@hope.dev',
  'siva.balan@hope.dev',
  'sri.moorthy@hope.dev',
  'tharunraj.s@hope.dev',
  'gaurrov.narayanan@hope.dev',
  'mohan.m@hope.dev',
  'nizarudeen.nizarudeen@hope.dev',
  'prajeeth.h@hope.dev',
  'santhosh.kumar@hope.dev',
  'sreesanth.r@hope.dev',
  'harini.m@hope.dev',
  'vigneshwaran.s@hope.dev',
  'allen.joseph@hope.dev',
  'arulananth.a@hope.dev',
  'jebasingh.sunderson@hope.dev',
  'jebin.simon@hope.dev',
  'joanna.kiruba@hope.dev',
  'jolin.a@hope.dev',
  'kesavan.balaji@hope.dev',
  'michael.franklin@hope.dev',
  'ricardo.r@hope.dev',
  'rohith.kumar@hope.dev',
  'santhosh.l@hope.dev',
  'moddheswar.s@hope.dev',
  'ayesha.hussain@hope.dev',
  'jaswin.rajkumar@hope.dev',
  'meenakshi.s@hope.dev',
  'siddharth.s@hope.dev',
  'raja.varshan@hope.dev',
  'tisha.angel@hope.dev',
  'allen.jusvin@hope.dev',
  'hariharan.r@hope.dev',
  'jagan.sridhar@hope.dev',
  'krishnakumar.r@hope.dev',
  'nandhana.ma@hope.dev',
  'sethumathavan.s@hope.dev',
  'sushan.kannah@hope.dev',
  'udhaya.kumar@hope.dev',
  'vignesh.r@hope.dev',
  'kamalesh.k@hope.dev',
  'tamilselvan.k@hope.dev',
  'tholkappiyan.v@hope.dev',
  'varadharaj.s@hope.dev',
  'vasanthakumar.s@hope.dev',
  'pavithra.b@hope.dev',
  'madhav.r@hope.dev',
  'tamilselvan.s@hope.dev',
  'dharani.p@hope.dev',
  'bavan.balaji@hope.dev',
  'pragadheesh.s@hope.dev',
  'danish.basha@hope.dev',
  'mangala.swetha@hope.dev',
  'aadithia.kumar@hope.dev',
];

const BATCH_NAME = 'HOPE Elite 2028 Batch';
const MENTOR_NAME = 'Karthi M';
const MENTOR_EMAIL = 'karthi.m@hope.dev';

async function main() {
  console.log('🚀 Setting up HOPE Elite 2028 Batch...\n');

  // ========================================
  // 1. Find or Create Mentor Role
  // ========================================
  console.log('📋 Step 1: Finding MENTOR role...');
  const mentorRole = await prisma.role.findUnique({
    where: { name: 'MENTOR' }
  });

  if (!mentorRole) {
    console.error('❌ MENTOR role not found in database');
    process.exit(1);
  }
  console.log(`✅ Found MENTOR role (ID: ${mentorRole.id})\n`);

  // ========================================
  // 2. Create Mentor User: Karthi M
  // ========================================
  console.log('👨‍🏫 Step 2: Creating mentor Karthi M...');

  let mentor = await prisma.user.findUnique({
    where: { email: MENTOR_EMAIL }
  });

  if (mentor) {
    console.log(`⚠️  Mentor already exists: ${mentor.name} (${mentor.email})`);
  } else {
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    mentor = await prisma.user.create({
      data: {
        name: MENTOR_NAME,
        email: MENTOR_EMAIL,
        passwordHash,
        roleId: mentorRole.id,
        status: 'ACTIVE',
        department: 'Computer Science',
      }
    });
    console.log(`✅ Created mentor: ${mentor.name} (${mentor.email})`);
  }
  console.log('');

  // ========================================
  // 3. Create or Find Batch
  // ========================================
  console.log('🎓 Step 3: Creating batch...');

  let batch = await prisma.batch.findFirst({
    where: { name: BATCH_NAME }
  });

  if (batch) {
    console.log(`⚠️  Batch already exists: ${batch.name} (ID: ${batch.id})`);
  } else {
    const startDate = new Date('2028-01-15'); // Example start date
    const endDate = new Date('2028-12-15'); // Example end date

    batch = await prisma.batch.create({
      data: {
        name: BATCH_NAME,
        department: 'Computer Science',
        startDate,
        endDate,
        description: 'Elite training batch for advanced full-stack development and ML engineering',
      }
    });
    console.log(`✅ Created batch: ${batch.name} (ID: ${batch.id})`);
  }
  console.log('');

  // ========================================
  // 4. Find All Students from Names.csv
  // ========================================
  console.log('👥 Step 4: Finding students from Names.csv...');

  const students = await prisma.user.findMany({
    where: {
      email: { in: STUDENT_EMAILS }
    },
    select: { id: true, name: true, email: true }
  });

  console.log(`✅ Found ${students.length}/${STUDENT_EMAILS.length} students in database\n`);

  if (students.length < STUDENT_EMAILS.length) {
    const foundEmails = new Set(students.map(s => s.email));
    const missing = STUDENT_EMAILS.filter(e => !foundEmails.has(e));
    console.log(`⚠️  Missing students: ${missing.join(', ')}\n`);
  }

  // ========================================
  // 5. Assign Students to Batch
  // ========================================
  console.log('📝 Step 5: Assigning students to batch...');

  // Check existing assignments
  const existingAssignments = await prisma.batchMember.findMany({
    where: {
      batchId: batch.id,
      studentId: { in: students.map(s => s.id) }
    },
    select: { studentId: true }
  });

  const existingStudentIds = new Set(existingAssignments.map(a => a.studentId));
  const newStudents = students.filter(s => !existingStudentIds.has(s.id));

  if (newStudents.length === 0) {
    console.log(`⚠️  All students already assigned to batch`);
  } else {
    await prisma.batchMember.createMany({
      data: newStudents.map(student => ({
        batchId: batch.id,
        studentId: student.id,
      })),
      skipDuplicates: true,
    });
    console.log(`✅ Assigned ${newStudents.length} students to batch`);
  }

  const totalMembers = await prisma.batchMember.count({
    where: { batchId: batch.id }
  });
  console.log(`📊 Total batch members: ${totalMembers}\n`);

  // ========================================
  // 6. Assign Mentor to All Students
  // ========================================
  console.log('🤝 Step 6: Creating mentor assignments...');

  const existingMentorAssignments = await prisma.mentorAssignment.findMany({
    where: {
      mentorId: mentor.id,
      studentId: { in: students.map(s => s.id) }
    },
    select: { studentId: true }
  });

  const existingMentorStudentIds = new Set(existingMentorAssignments.map(a => a.studentId));
  const studentsNeedingMentor = students.filter(s => !existingMentorStudentIds.has(s.id));

  if (studentsNeedingMentor.length === 0) {
    console.log(`⚠️  All students already assigned to mentor`);
  } else {
    await prisma.mentorAssignment.createMany({
      data: studentsNeedingMentor.map(student => ({
        mentorId: mentor.id,
        studentId: student.id,
      })),
      skipDuplicates: true,
    });
    console.log(`✅ Assigned ${studentsNeedingMentor.length} students to mentor ${MENTOR_NAME}`);
  }

  const totalMentorAssignments = await prisma.mentorAssignment.count({
    where: { mentorId: mentor.id }
  });
  console.log(`📊 Total mentor assignments for ${MENTOR_NAME}: ${totalMentorAssignments}\n`);

  // ========================================
  // 7. Create Sample Session with Attendance Window
  // ========================================
  console.log('📅 Step 7: Creating sample session with attendance window...');

  // Find or create a trainer for the session
  const trainerRole = await prisma.role.findUnique({ where: { name: 'TRAINER' } });
  let trainer = await prisma.user.findFirst({
    where: { roleId: trainerRole?.id }
  });

  if (!trainer) {
    console.log('⚠️  No trainer found, creating default trainer...');
    const trainerPasswordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    trainer = await prisma.user.create({
      data: {
        name: 'Default Trainer',
        email: 'trainer@hope.dev',
        passwordHash: trainerPasswordHash,
        roleId: trainerRole!.id,
        status: 'ACTIVE',
      }
    });
    console.log(`✅ Created trainer: ${trainer.name}`);
  }

  // Create a sample session
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 0, 0, 0); // 7:00 AM

  const sessionStartTime = new Date(tomorrow);
  sessionStartTime.setHours(7, 0, 0, 0); // 7:00 AM

  const sessionEndTime = new Date(tomorrow);
  sessionEndTime.setHours(10, 0, 0, 0); // 10:00 AM (3-hour session)

  const existingSession = await prisma.session.findFirst({
    where: {
      batchId: batch.id,
      scheduledDate: {
        gte: new Date(tomorrow.setHours(0, 0, 0, 0)),
        lt: new Date(tomorrow.setHours(23, 59, 59, 999))
      }
    }
  });

  let session;
  if (existingSession) {
    console.log(`⚠️  Session already exists for tomorrow`);
    session = existingSession;
  } else {
    session = await prisma.session.create({
      data: {
        batchId: batch.id,
        trainerId: trainer.id,
        title: 'Introduction to Advanced Programming',
        topic: 'Data structures, algorithms, and problem-solving techniques',
        scheduledDate: tomorrow,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
      }
    });
    console.log(`✅ Created session: ${session.title}`);
  }

  // Create attendance window (7:00 AM - 8:10 AM)
  const windowStartTime = new Date(tomorrow);
  windowStartTime.setHours(7, 0, 0, 0); // 7:00 AM

  const windowEndTime = new Date(tomorrow);
  windowEndTime.setHours(8, 10, 0, 0); // 8:10 AM

  const existingWindow = await prisma.attendanceWindow.findFirst({
    where: { sessionId: session.id }
  });

  if (existingWindow) {
    console.log(`⚠️  Attendance window already exists`);
  } else {
    await prisma.attendanceWindow.create({
      data: {
        sessionId: session.id,
        label: 'Morning Check-In',
        startTime: windowStartTime,
        endTime: windowEndTime,
      }
    });
    console.log(`✅ Created attendance window: 7:00 AM - 8:10 AM (Morning Check-In)`);
  }
  console.log('');

  // ========================================
  // Summary
  // ========================================
  console.log('═'.repeat(80));
  console.log('✅ HOPE Elite 2028 Batch Setup Complete!');
  console.log('═'.repeat(80));
  console.log('');
  console.log('📊 Summary:');
  console.log(`   • Batch: ${BATCH_NAME}`);
  console.log(`   • Batch ID: ${batch.id}`);
  console.log(`   • Total Students: ${totalMembers}`);
  console.log(`   • Mentor: ${MENTOR_NAME} (${MENTOR_EMAIL})`);
  console.log(`   • Mentor Assignments: ${totalMentorAssignments}`);
  console.log(`   • Sample Session: ${session.title}`);
  console.log(`   • Attendance Window: 7:00 AM - 8:10 AM`);
  console.log('');
  console.log('🔑 Mentor Login Credentials:');
  console.log(`   • Email: ${MENTOR_EMAIL}`);
  console.log(`   • Password: ${SEED_PASSWORD}`);
  console.log('');
  console.log('📝 Students from Names.csv:');
  console.log(`   • All ${students.length} students assigned to batch`);
  console.log(`   • All ${students.length} students assigned to mentor ${MENTOR_NAME}`);
  console.log('');
  console.log('🎓 Next Steps:');
  console.log('   1. Login as mentor: karthi.m@hope.dev');
  console.log('   2. View batch students in batch management');
  console.log('   3. Mark attendance during 7:00 AM - 8:10 AM window');
  console.log('   4. Add assessments and feedback for students');
  console.log('   5. Monitor risk scores and interventions');
  console.log('');
  console.log('✅ Ready to use!');
}

main()
  .catch((error) => {
    console.error('');
    console.error('❌ Error setting up batch:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
