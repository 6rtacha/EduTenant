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

  // Must delete enrollments before users AND classes (both are FK targets)
  await prisma.homeworkSubmission.deleteMany({
    where: { tenantId: tenant.id },
  });
  await prisma.homework.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.attendance.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.enrollment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.schedule.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.notice.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.parentStudent.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.class.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
}
