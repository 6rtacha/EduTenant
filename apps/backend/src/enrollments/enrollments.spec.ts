import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import prisma, {
  cleanupTestTenant,
  seedTestTenant,
} from '../common/test/prisma-test';

type EnrollmentResponse = {
  id: string;
  status: string;
  user: { id: string };
  class: { id: string };
};

describe('Enrollments', () => {
  let app: INestApplication<App>;

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
  });

  afterEach(async () => {
    await cleanupTestTenant('enroll-a');
    await cleanupTestTenant('enroll-b');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('enrolls, pauses, withdraws, and reactivates a student', async () => {
    const { owner, student, klass } = await seedTestTenant('enroll-a');

    const created = await request(app.getHttpServer())
      .post('/enrollments')
      .set('x-tenant-slug', 'enroll-a')
      .set('x-user-id', owner.id)
      .send({ userId: student.id, classId: klass.id })
      .expect(201);

    const createdBody = created.body as EnrollmentResponse;
    expect(createdBody.status).toBe('ACTIVE');

    const paused = await request(app.getHttpServer())
      .patch(`/enrollments/${createdBody.id}/status`)
      .set('x-tenant-slug', 'enroll-a')
      .set('x-user-id', owner.id)
      .send({ status: 'PAUSED' })
      .expect(200);

    expect((paused.body as EnrollmentResponse).status).toBe('PAUSED');

    const withdrawn = await request(app.getHttpServer())
      .delete(`/enrollments/${createdBody.id}`)
      .set('x-tenant-slug', 'enroll-a')
      .set('x-user-id', owner.id)
      .expect(200);

    expect((withdrawn.body as EnrollmentResponse).status).toBe('WITHDRAWN');

    const reactivated = await request(app.getHttpServer())
      .post('/enrollments')
      .set('x-tenant-slug', 'enroll-a')
      .set('x-user-id', owner.id)
      .send({ userId: student.id, classId: klass.id })
      .expect(201);

    const reactivatedBody = reactivated.body as EnrollmentResponse;
    expect(reactivatedBody.id).toBe(createdBody.id);
    expect(reactivatedBody.status).toBe('ACTIVE');
  });

  it('rejects duplicate active enrollments and full classes', async () => {
    const { owner, student, klass } = await seedTestTenant('enroll-a');

    await prisma.class.update({
      where: { id: klass.id },
      data: { maxStudents: 1 },
    });

    await request(app.getHttpServer())
      .post('/enrollments')
      .set('x-tenant-slug', 'enroll-a')
      .set('x-user-id', owner.id)
      .send({ userId: student.id, classId: klass.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/enrollments')
      .set('x-tenant-slug', 'enroll-a')
      .set('x-user-id', owner.id)
      .send({ userId: student.id, classId: klass.id })
      .expect(409);

    const secondStudent = await prisma.user.create({
      data: {
        tenantId: owner.tenantId,
        email: 'second-student@enroll-a.test',
        name: 'Second Student',
        role: 'STUDENT',
      },
    });

    await request(app.getHttpServer())
      .post('/enrollments')
      .set('x-tenant-slug', 'enroll-a')
      .set('x-user-id', owner.id)
      .send({ userId: secondStudent.id, classId: klass.id })
      .expect(409);
  });

  it('rejects cross-tenant students and non-student enrollment', async () => {
    const { owner: ownerA, klass } = await seedTestTenant('enroll-a');
    const { student: studentB } = await seedTestTenant('enroll-b');

    await request(app.getHttpServer())
      .post('/enrollments')
      .set('x-tenant-slug', 'enroll-a')
      .set('x-user-id', ownerA.id)
      .send({ userId: studentB.id, classId: klass.id })
      .expect(400);

    await request(app.getHttpServer())
      .post('/enrollments')
      .set('x-tenant-slug', 'enroll-a')
      .set('x-user-id', ownerA.id)
      .send({ userId: ownerA.id, classId: klass.id })
      .expect(400);
  });
});
