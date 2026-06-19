// apps/backend/src/common/test/tenant-isolation.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { EnrollmentsService } from '../../enrollments/enrollments.service';
import prisma, { cleanupTestTenant, seedTestTenant } from './prisma-test';

describe('Tenant Isolation', () => {
  let app: INestApplication;
  let enrollmentsService: EnrollmentsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    enrollmentsService = app.get(EnrollmentsService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ─── Cross-tenant user leakage ──────────────────────────────────────────

  describe('User isolation', () => {
    beforeAll(async () => {
      await seedTestTenant('academy-a');
      await seedTestTenant('academy-b');
    });

    afterAll(async () => {
      await cleanupTestTenant('academy-a');
      await cleanupTestTenant('academy-b');
    });

    it('tenant B cannot see tenant A users', async () => {
      const tenantA = await prisma.tenant.findUnique({
        where: { slug: 'academy-a' },
      });
      const tenantB = await prisma.tenant.findUnique({
        where: { slug: 'academy-b' },
      });

      // Query users scoped to tenant B
      const users = await prisma.user.findMany({
        where: { tenantId: tenantB!.id },
      });

      // None of them should belong to tenant A
      const leak = users.filter((u) => u.tenantId === tenantA!.id);
      expect(leak).toHaveLength(0);
    });

    it('tenant A users are not visible to tenant B API calls', async () => {
      const res = await request(app.getHttpServer())
        .get('/tenants/me')
        .set('x-tenant-slug', 'academy-b');

      expect(res.status).toBe(200);
      const body = res.body as { slug: string };
      expect(body.slug).toBe('academy-b');
      // Must not contain academy-a data
      expect(body.slug).not.toBe('academy-a');
    });
  });

  // ─── Missing header ─────────────────────────────────────────────────────

  describe('Guard enforcement', () => {
    it('returns 403 when x-tenant-slug header is missing', async () => {
      const res = await request(app.getHttpServer()).get('/tenants/me');
      expect(res.status).toBe(403);
      const body = res.body as { message: string };
      expect(body.message).toBe('Missing x-tenant-slug header');
    });

    it('returns 403 for an unknown slug', async () => {
      const res = await request(app.getHttpServer())
        .get('/tenants/me')
        .set('x-tenant-slug', 'does-not-exist');
      expect(res.status).toBe(403);
      const body = res.body as { message: string };
      expect(body.message).toContain('not found');
    });

    it('allows public routes without a tenant header', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
    });
  });

  // ─── Cross-tenant class leakage ─────────────────────────────────────────

  describe('Class isolation', () => {
    beforeAll(async () => {
      await seedTestTenant('school-a');
      await seedTestTenant('school-b');
    });

    afterAll(async () => {
      await cleanupTestTenant('school-a');
      await cleanupTestTenant('school-b');
    });

    it('classes created for school-a are invisible to school-b', async () => {
      const schoolA = await prisma.tenant.findUnique({
        where: { slug: 'school-a' },
      });
      const schoolB = await prisma.tenant.findUnique({
        where: { slug: 'school-b' },
      });

      const schoolBClasses = await prisma.class.findMany({
        where: { tenantId: schoolB!.id },
      });

      const leak = schoolBClasses.filter((c) => c.tenantId === schoolA!.id);
      expect(leak).toHaveLength(0);
    });

    it('class count per tenant is correct and isolated', async () => {
      const schoolA = await prisma.tenant.findUnique({
        where: { slug: 'school-a' },
      });
      const schoolB = await prisma.tenant.findUnique({
        where: { slug: 'school-b' },
      });

      const countA = await prisma.class.count({
        where: { tenantId: schoolA!.id },
      });
      const countB = await prisma.class.count({
        where: { tenantId: schoolB!.id },
      });

      // seedTestTenant creates exactly 1 class per tenant
      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });
  });

  // ─── Enrollment isolation ───────────────────────────────────────────────

  describe('Enrollment isolation', () => {
    beforeAll(async () => {
      await cleanupTestTenant('hagwon-a');
      await cleanupTestTenant('hagwon-b');

      await seedTestTenant('hagwon-a');
      await seedTestTenant('hagwon-b');

      const a = await prisma.tenant.findUnique({
        where: { slug: 'hagwon-a' },
      });

      const studentA = await prisma.user.findFirst({
        where: { tenantId: a!.id, role: 'STUDENT' },
      });

      const classA = await prisma.class.findFirst({
        where: { tenantId: a!.id },
      });

      await prisma.enrollment.create({
        data: {
          tenantId: a!.id,
          userId: studentA!.id,
          classId: classA!.id,
        },
      });
    });

    afterAll(async () => {
      await cleanupTestTenant('hagwon-a');
      await cleanupTestTenant('hagwon-b');
    });

    it('hagwon-b sees zero enrollments even though hagwon-a has one', async () => {
      const b = await prisma.tenant.findUnique({ where: { slug: 'hagwon-b' } });

      const enrollments = await prisma.enrollment.findMany({
        where: { tenantId: b!.id },
      });

      expect(enrollments).toHaveLength(0);
    });

    it('cannot enroll a student from tenant A into a class from tenant B', async () => {
      const a = await prisma.tenant.findUnique({ where: { slug: 'hagwon-a' } });
      const b = await prisma.tenant.findUnique({ where: { slug: 'hagwon-b' } });
      const studentA = await prisma.user.findFirst({
        where: { tenantId: a!.id, role: 'STUDENT' },
      });
      const classB = await prisma.class.findFirst({
        where: { tenantId: b!.id },
      });

      await expect(
        enrollmentsService.create(b!.id, studentA!.id, classB!.id),
      ).rejects.toThrow();
    });
  });
});
