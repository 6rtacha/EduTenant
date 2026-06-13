import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import prisma, {
  cleanupTestTenant,
  seedTestTenant,
} from '../common/test/prisma-test';

describe('Classes', () => {
  let app: INestApplication<App>;

  type ClassResponse = {
    id: string;
    name: string;
    schedules: Array<{ dayOfWeek: number }>;
  };

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
    await cleanupTestTenant('classes-a');
    await cleanupTestTenant('classes-b');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates, lists, updates, and deletes classes inside one tenant', async () => {
    const { owner } = await seedTestTenant('classes-a');

    const created = await request(app.getHttpServer())
      .post('/classes')
      .set('x-tenant-slug', 'classes-a')
      .set('x-user-id', owner.id)
      .send({
        name: 'Algebra A',
        subject: 'Math',
        instructorId: owner.id,
        maxStudents: 12,
        schedules: [
          {
            dayOfWeek: 1,
            startTime: '14:00',
            endTime: '15:30',
            room: '201',
          },
        ],
      })
      .expect(201);

    const createdBody = created.body as ClassResponse;

    expect(createdBody.name).toBe('Algebra A');
    expect(createdBody.schedules).toHaveLength(1);

    const list = await request(app.getHttpServer())
      .get('/classes')
      .set('x-tenant-slug', 'classes-a')
      .set('x-user-id', owner.id)
      .expect(200);

    const listBody = list.body as Array<{ id: string }>;

    expect(listBody.some((klass) => klass.id === createdBody.id)).toBe(true);

    const updated = await request(app.getHttpServer())
      .patch(`/classes/${createdBody.id}`)
      .set('x-tenant-slug', 'classes-a')
      .set('x-user-id', owner.id)
      .send({
        name: 'Algebra B',
        schedules: [
          {
            dayOfWeek: 3,
            startTime: '16:00',
            endTime: '17:30',
          },
        ],
      })
      .expect(200);

    const updatedBody = updated.body as ClassResponse;

    expect(updatedBody.name).toBe('Algebra B');
    expect(updatedBody.schedules[0].dayOfWeek).toBe(3);

    await request(app.getHttpServer())
      .delete(`/classes/${createdBody.id}`)
      .set('x-tenant-slug', 'classes-a')
      .set('x-user-id', owner.id)
      .expect(200);
  });

  it('does not expose or mutate another tenant class', async () => {
    const { owner: ownerA, klass: classA } = await seedTestTenant('classes-a');
    const { owner: ownerB } = await seedTestTenant('classes-b');

    await request(app.getHttpServer())
      .get(`/classes/${classA.id}`)
      .set('x-tenant-slug', 'classes-b')
      .set('x-user-id', ownerB.id)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/classes/${classA.id}`)
      .set('x-tenant-slug', 'classes-b')
      .set('x-user-id', ownerB.id)
      .send({ name: 'Leaked Update' })
      .expect(404);

    const untouched = await prisma.class.findFirst({
      where: { id: classA.id, tenantId: ownerA.tenantId },
    });
    expect(untouched?.name).not.toBe('Leaked Update');
  });

  it('rejects cross-tenant instructor assignment and student writes', async () => {
    const { owner: ownerA, student } = await seedTestTenant('classes-a');
    const { owner: ownerB } = await seedTestTenant('classes-b');

    await request(app.getHttpServer())
      .post('/classes')
      .set('x-tenant-slug', 'classes-a')
      .set('x-user-id', ownerA.id)
      .send({
        name: 'Cross Tenant',
        subject: 'Math',
        instructorId: ownerB.id,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/classes')
      .set('x-tenant-slug', 'classes-a')
      .set('x-user-id', student.id)
      .send({
        name: 'Student Created',
        subject: 'Math',
        instructorId: ownerA.id,
      })
      .expect(403);
  });
});
