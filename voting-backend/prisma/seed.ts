import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding College Colors Voting Database...');

  // 1. Clean existing sample data (safe in dev)
  await prisma.voteChoice.deleteMany({});
  await prisma.voteColor.deleteMany({});
  await prisma.vote.deleteMany({});
  await prisma.otpCode.deleteMany({});
  await prisma.representative.deleteMany({});
  await prisma.college.deleteMany({});
  await prisma.university.deleteMany({});

  // 2. University 1: جامعة بغداد (University of Baghdad)
  const uBaghdad = await prisma.university.create({
    data: {
      name: 'جامعة بغداد',
      colleges: {
        create: [
          {
            name: 'كلية الطب',
            fixedEntityId: 'UOB-MED-2026',
          },
          {
            name: 'كلية الهندسة',
            fixedEntityId: 'UOB-ENG-2026',
          },
          {
            name: 'كلية الصيدلة',
            fixedEntityId: 'UOB-PHARM-2026',
          },
          {
            name: 'كلية العلوم',
            fixedEntityId: 'UOB-SCI-2026',
          },
        ],
      },
    },
    include: { colleges: true },
  });

  // 3. University 2: جامعة كربلاء (University of Karbala)
  const uKarbala = await prisma.university.create({
    data: {
      name: 'جامعة كربلاء',
      colleges: {
        create: [
          {
            name: 'كلية طب الأسنان',
            fixedEntityId: 'UOK-DENT-2026',
          },
          {
            name: 'كلية الهندسة',
            fixedEntityId: 'UOK-ENG-2026',
          },
          {
            name: 'كلية القانون',
            fixedEntityId: 'UOK-LAW-2026',
          },
          {
            name: 'كلية تكنولوجيا المعلومات',
            fixedEntityId: 'UOK-IT-2026',
          },
        ],
      },
    },
    include: { colleges: true },
  });

  // 4. University 3: جامعة بابل (University of Babylon)
  const uBabylon = await prisma.university.create({
    data: {
      name: 'جامعة بابل',
      colleges: {
        create: [
          {
            name: 'كلية الطب البشري',
            fixedEntityId: 'UOBAB-MED-2026',
          },
          {
            name: 'كلية هندسة المواد',
            fixedEntityId: 'UOBAB-MATENG-2026',
          },
          {
            name: 'كلية التمريض',
            fixedEntityId: 'UOBAB-NURSE-2026',
          },
        ],
      },
    },
    include: { colleges: true },
  });

  console.log(`Seeded Universities:
  - ${uBaghdad.name} (${uBaghdad.colleges.length} colleges)
  - ${uKarbala.name} (${uKarbala.colleges.length} colleges)
  - ${uBabylon.name} (${uBabylon.colleges.length} colleges)`);
  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
