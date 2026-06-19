// apps/backend/src/common/test/prisma-test.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL },
  },
});

export default prisma;

/**
 * Creates a tenant + one user of each role for isolation testing.
 * Returns the tenant and the created users.
 */
export async function seedTestTenant(slug: string) {
  const tenant = await prisma.tenant.create({
    data: { name: `Test ${slug}`, slug },
  });

  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `owner@${slug}.com`,
      name: 'Owner',
      role: 'OWNER',
    },
  });

  const student = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `student@${slug}.com`,
      name: 'Student',
      role: 'STUDENT',
    },
  });

  const klass = await prisma.class.create({
    data: {
      tenantId: tenant.id,
      name: `${slug} Math`,
      subject: '수학',
      instructorId: owner.id,
    },
  });

  return { tenant, owner, student, klass };
}

/**
 * Wipes all test data for a given slug. Call in afterEach/afterAll.
 */
export async function cleanupTestTenant(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return;

  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });

  const classes = await prisma.class.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });

  const userIds = users.map(({ id }) => id);
  const classIds = classes.map(({ id }) => id);

  await prisma.homeworkSubmission.deleteMany({
    where: {
      OR: [{ tenantId: tenant.id }, { userId: { in: userIds } }],
    },
  });

  await prisma.attendance.deleteMany({
    where: {
      OR: [
        { tenantId: tenant.id },
        { userId: { in: userIds } },
        { schedule: { classId: { in: classIds } } },
      ],
    },
  });

  await prisma.enrollment.deleteMany({
    where: {
      OR: [
        { tenantId: tenant.id },
        { userId: { in: userIds } },
        { classId: { in: classIds } },
      ],
    },
  });

  await prisma.schedule.deleteMany({
    where: {
      OR: [{ tenantId: tenant.id }, { classId: { in: classIds } }],
    },
  });

  await prisma.homework.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.notice.deleteMany({ where: { tenantId: tenant.id } });

  await prisma.parentStudent.deleteMany({
    where: {
      OR: [
        { tenantId: tenant.id },
        { parentId: { in: userIds } },
        { studentId: { in: userIds } },
      ],
    },
  });

  await prisma.class.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
}
