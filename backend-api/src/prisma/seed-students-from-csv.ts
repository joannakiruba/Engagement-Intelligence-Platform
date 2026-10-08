/**
 * Seed students from Names.csv file
 * Creates student accounts with email format: firstname.lastname@hope.dev
 */

import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';

const SEED_PASSWORD = process.env.SEED_TEST_PASSWORD || 'HopeTest2026!@dev';

// Names from Names.csv
const STUDENT_NAMES = [
  "AKASH M",
  "JEEVAN KINGSLEE J",
  "SANTHOSH S",
  "SIVA BALAN S",
  "SRI RAM MOORTHY S",
  "THARUNRAJ S",
  "GAURROV S NARAYANAN",
  "MOHAN M",
  "NIZARUDEEN .",
  "PRAJEETH H",
  "SANTHOSH KUMAR B",
  "SREESANTH R",
  "HARINI M",
  "VIGNESHWARAN S",
  "ALLEN JOSEPH G",
  "ARULANANTH A",
  "JEBASINGH SUNDERSON I",
  "JEBIN VICTOR SIMON",
  "JOANNA KIRUBA",
  "JOLIN A",
  "KESAVAN BALAJI",
  "MICHAEL JOHN FRANKLIN R",
  "RICARDO R",
  "ROHITH KUMAR S",
  "SANTHOSH L",
  "MODDHESWAR S P",
  "AYESHA SIDDIQA KWAZA HUSSAIN",
  "JASWIN RAJKUMAR A",
  "MEENAKSHI S",
  "SIDDHARTH S",
  "RAJA VARSHAN R R",
  "TISHA ANGEL E S",
  "ALLEN JUSVIN J",
  "HARIHARAN R",
  "JAGAN MUMMUDI SRIDHAR",
  "KRISHNAKUMAR R",
  "NANDHANA MA",
  "SETHUMATHAVAN S P",
  "SUSHAN KANNAH D",
  "UDHAYA KUMAR M",
  "VIGNESH R",
  "KAMALESH K",
  "TAMILSELVAN K",
  "THOLKAPPIYAN V",
  "VARADHARAJ S",
  "VASANTHAKUMAR S",
  "PAVITHRA B",
  "MADHAV R",
  "TAMILSELVAN S",
  "DHARANI P",
  "BAVAN BALAJI A",
  "PRAGADHEESH S",
  "DANISH BASHA N",
  "MANGALA SWETHA M",
  "AADITHIA VENKATA SURESH KUMAR"
];

/**
 * Convert name to email format: firstname.lastname@hope.dev
 * Handles names with initials and special cases
 */
function nameToEmail(fullName: string): { name: string; email: string } {
  // Remove periods and extra spaces
  let cleaned = fullName.replace(/\./g, '').trim();

  // Split into parts
  let parts = cleaned.split(/\s+/);

  // Filter out single letters (initials) from the end
  // But keep the first name even if it's single letter
  let nameParts = parts.filter((part, index) => {
    // Keep first part always
    if (index === 0) return true;
    // Keep parts that are more than 1 character
    return part.length > 1;
  });

  // If we only have one part or all were initials, use the original first two parts
  if (nameParts.length < 2 && parts.length >= 2) {
    nameParts = [parts[0], parts[1]];
  }

  // Take first name and last name for email
  const firstName = nameParts[0] || parts[0];
  const lastName = nameParts[nameParts.length - 1] || parts[parts.length - 1];

  // Create email: firstname.lastname@hope.dev (all lowercase)
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@hope.dev`;

  // For display name, use all meaningful parts (not single letters at the end)
  const displayParts = parts.filter(part => part.length > 1);
  const displayName = displayParts.length > 0 ? displayParts.join(' ') : fullName;

  return {
    name: displayName,
    email: email
  };
}

/**
 * Create unique emails by adding numbers if duplicates exist
 */
function createUniqueEmails(names: string[]): Array<{ name: string; email: string }> {
  const emailMap = new Map<string, number>();
  const result: Array<{ name: string; email: string }> = [];

  for (const name of names) {
    const { name: displayName, email: baseEmail } = nameToEmail(name);

    let finalEmail = baseEmail;

    // Check if email already exists
    if (emailMap.has(baseEmail)) {
      const count = emailMap.get(baseEmail)!;
      emailMap.set(baseEmail, count + 1);
      // Add number before @hope.dev
      finalEmail = baseEmail.replace('@hope.dev', `${count + 1}@hope.dev`);
    } else {
      emailMap.set(baseEmail, 1);
    }

    result.push({ name: displayName, email: finalEmail });
  }

  return result;
}

async function main() {
  console.log('🌱 Seeding students from Names.csv...\n');

  // Check if SEED_TEST_PASSWORD is set
  if (!process.env.SEED_TEST_PASSWORD) {
    console.error('❌ SEED_TEST_PASSWORD environment variable is not set');
    process.exit(1);
  }

  console.log(`📝 Total names to process: ${STUDENT_NAMES.length}`);
  console.log(`🔑 Using password from SEED_TEST_PASSWORD\n`);

  // Find STUDENT role
  const studentRole = await prisma.role.findUnique({
    where: { name: 'STUDENT' }
  });

  if (!studentRole) {
    console.error('❌ STUDENT role not found in database');
    console.error('   Run the main seed first: npm run seed');
    process.exit(1);
  }

  console.log(`✅ Found STUDENT role (ID: ${studentRole.id})\n`);

  // Generate unique emails
  const students = createUniqueEmails(STUDENT_NAMES);

  // Display email mapping
  console.log('📧 Email mappings:');
  console.log('─'.repeat(80));
  students.forEach((s, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${STUDENT_NAMES[i].padEnd(35)} → ${s.email}`);
  });
  console.log('─'.repeat(80));
  console.log('');

  // Hash password once for all students
  console.log('🔐 Hashing password...');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  console.log('✅ Password hashed\n');

  // Check for existing students
  const existingEmails = await prisma.user.findMany({
    where: {
      email: { in: students.map(s => s.email) }
    },
    select: { email: true }
  });

  const existingEmailSet = new Set(existingEmails.map(u => u.email));
  const newStudents = students.filter(s => !existingEmailSet.has(s.email));

  if (existingEmailSet.size > 0) {
    console.log(`⚠️  ${existingEmailSet.size} students already exist, skipping those`);
    console.log(`   Existing: ${Array.from(existingEmailSet).join(', ')}\n`);
  }

  if (newStudents.length === 0) {
    console.log('✅ All students already exist in database');
    return;
  }

  console.log(`📝 Creating ${newStudents.length} new student accounts...\n`);

  // Create students in batches
  const BATCH_SIZE = 10;
  let created = 0;

  for (let i = 0; i < newStudents.length; i += BATCH_SIZE) {
    const batch = newStudents.slice(i, i + BATCH_SIZE);

    await prisma.user.createMany({
      data: batch.map(student => ({
        name: student.name,
        email: student.email,
        passwordHash,
        roleId: studentRole.id,
        status: 'ACTIVE', // Set as active so they can log in immediately
        department: 'Computer Science', // Default department
        year: 3, // Default year
      })),
      skipDuplicates: true,
    });

    created += batch.length;
    console.log(`   ✓ Created batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newStudents.length / BATCH_SIZE)} (${created}/${newStudents.length})`);
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ Student seeding complete!');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`📊 Summary:`);
  console.log(`   • Total names processed: ${STUDENT_NAMES.length}`);
  console.log(`   • Already existed: ${existingEmailSet.size}`);
  console.log(`   • Newly created: ${created}`);
  console.log(`   • Role: STUDENT (${studentRole.id})`);
  console.log(`   • Status: ACTIVE`);
  console.log(`   • Department: Computer Science`);
  console.log(`   • Year: 3`);
  console.log('');
  console.log(`🔑 Login credentials:`);
  console.log(`   • Email: <firstname>.<lastname>@hope.dev`);
  console.log(`   • Password: ${SEED_PASSWORD}`);
  console.log('');
  console.log(`📝 Example logins:`);
  console.log(`   • ${students[0].email} / ${SEED_PASSWORD}`);
  console.log(`   • ${students[1].email} / ${SEED_PASSWORD}`);
  console.log(`   • ${students[2].email} / ${SEED_PASSWORD}`);
  console.log('');
  console.log('🎓 All students are ready to log in!');
}

main()
  .catch((error) => {
    console.error('');
    console.error('❌ Error seeding students:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
