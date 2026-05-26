import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // =========================================================================
  // 1. Default Admin User
  // =========================================================================
  const adminPassword = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      fullName: 'Administrator',
      role: UserRole.ADMIN,
      active: true,
    },
  });
  console.log(`✓ Admin user created: ${admin.username} (role: ${admin.role})`);

  // Create demo radiographer
  const radiographerPassword = await bcrypt.hash('radiographer123', 12);
  const radiographer = await prisma.user.upsert({
    where: { username: 'radiographer' },
    update: {},
    create: {
      username: 'radiographer',
      passwordHash: radiographerPassword,
      fullName: 'Demo Radiographer',
      role: UserRole.RADIOGRAPHER,
      active: true,
    },
  });
  console.log(`✓ Radiographer user created: ${radiographer.username}`);

  // Create demo radiologist
  const radiologistPassword = await bcrypt.hash('radiologist123', 12);
  const radiologist = await prisma.user.upsert({
    where: { username: 'radiologist' },
    update: {},
    create: {
      username: 'radiologist',
      passwordHash: radiologistPassword,
      fullName: 'Dr. Demo Radiologist',
      role: UserRole.RADIOLOGIST,
      active: true,
    },
  });
  console.log(`✓ Radiologist user created: ${radiologist.username}`);

  // =========================================================================
  // 2. Radiology Exam Master
  // =========================================================================
  const exams = [
    {
      examCode: 'XR_CHEST_PA',
      examName: 'X-Ray Chest PA',
      modalityCode: 'CR',
      loincCode: '36643-5',
      loincDisplay: 'XR Chest PA',
      kptlCode: '87.44',
      kptlDisplay: 'Rontgen dada rutin',
      studyDescription: 'CHEST PA',
      bodyPart: 'CHEST',
      accessionPrefix: 'XR',
    },
    {
      examCode: 'XR_CHEST_AP',
      examName: 'X-Ray Chest AP',
      modalityCode: 'CR',
      loincCode: '36554-4',
      loincDisplay: 'XR Chest AP',
      kptlCode: '87.44',
      kptlDisplay: 'Rontgen dada rutin',
      studyDescription: 'CHEST AP',
      bodyPart: 'CHEST',
      accessionPrefix: 'XR',
    },
    {
      examCode: 'XR_THORAX_LAT',
      examName: 'X-Ray Thorax Lateral',
      modalityCode: 'CR',
      loincCode: '36572-6',
      loincDisplay: 'XR Chest Lateral',
      kptlCode: '87.44',
      kptlDisplay: 'Rontgen dada rutin',
      studyDescription: 'THORAX LATERAL',
      bodyPart: 'CHEST',
      accessionPrefix: 'XR',
    },
    {
      examCode: 'XR_ABDOMEN_AP',
      examName: 'X-Ray Abdomen AP (BNO)',
      modalityCode: 'CR',
      loincCode: '36951-2',
      loincDisplay: 'XR Abdomen AP',
      kptlCode: '88.19',
      kptlDisplay: 'Rontgen abdomen lainnya',
      studyDescription: 'ABDOMEN AP',
      bodyPart: 'ABDOMEN',
      accessionPrefix: 'XR',
    },
    {
      examCode: 'XR_EXTREMITAS',
      examName: 'X-Ray Extremitas',
      modalityCode: 'CR',
      loincCode: '37436-7',
      loincDisplay: 'XR Bone',
      kptlCode: '88.29',
      kptlDisplay: 'Rontgen tulang lainnya',
      studyDescription: 'EXTREMITAS',
      bodyPart: 'EXTREMITY',
      accessionPrefix: 'XR',
    },
    {
      examCode: 'XR_SKULL_AP_LAT',
      examName: 'X-Ray Skull AP/Lateral',
      modalityCode: 'CR',
      loincCode: '36589-0',
      loincDisplay: 'XR Skull',
      kptlCode: '87.17',
      kptlDisplay: 'Rontgen kepala lainnya',
      studyDescription: 'SKULL AP LAT',
      bodyPart: 'HEAD',
      accessionPrefix: 'XR',
    },
    {
      examCode: 'CT_HEAD',
      examName: 'CT Scan Head',
      modalityCode: 'CT',
      loincCode: '30799-1',
      loincDisplay: 'CT Head',
      kptlCode: '87.03',
      kptlDisplay: 'CT scan kepala',
      studyDescription: 'CT HEAD',
      bodyPart: 'HEAD',
      accessionPrefix: 'CT',
    },
    {
      examCode: 'CT_ABDOMEN',
      examName: 'CT Scan Abdomen',
      modalityCode: 'CT',
      loincCode: '30688-6',
      loincDisplay: 'CT Abdomen',
      kptlCode: '88.01',
      kptlDisplay: 'CT scan abdomen',
      studyDescription: 'CT ABDOMEN',
      bodyPart: 'ABDOMEN',
      accessionPrefix: 'CT',
    },
    {
      examCode: 'CT_THORAX',
      examName: 'CT Scan Thorax',
      modalityCode: 'CT',
      loincCode: '30746-2',
      loincDisplay: 'CT Chest',
      kptlCode: '87.41',
      kptlDisplay: 'CT scan thorax',
      studyDescription: 'CT THORAX',
      bodyPart: 'CHEST',
      accessionPrefix: 'CT',
    },
    {
      examCode: 'MRI_BRAIN',
      examName: 'MRI Brain',
      modalityCode: 'MR',
      loincCode: '30795-9',
      loincDisplay: 'MR Brain',
      kptlCode: '88.91',
      kptlDisplay: 'MRI otak',
      studyDescription: 'MRI BRAIN',
      bodyPart: 'HEAD',
      accessionPrefix: 'MRI',
    },
    {
      examCode: 'USG_ABDOMEN',
      examName: 'USG Abdomen',
      modalityCode: 'US',
      loincCode: '30713-2',
      loincDisplay: 'US Abdomen',
      kptlCode: '88.76',
      kptlDisplay: 'USG abdomen',
      studyDescription: 'USG ABDOMEN',
      bodyPart: 'ABDOMEN',
      accessionPrefix: 'USG',
    },
    {
      examCode: 'USG_OBSTETRI',
      examName: 'USG Obstetri',
      modalityCode: 'US',
      loincCode: '11525-3',
      loincDisplay: 'US Pelvis Fetus',
      kptlCode: '88.78',
      kptlDisplay: 'USG obstetri',
      studyDescription: 'USG OBSTETRI',
      bodyPart: 'PELVIS',
      accessionPrefix: 'USG',
    },
  ];

  for (const exam of exams) {
    await prisma.radiologyExamMaster.upsert({
      where: { examCode: exam.examCode },
      update: exam,
      create: exam,
    });
  }
  console.log(`✓ Radiology exam master seeded: ${exams.length} entries`);

  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
