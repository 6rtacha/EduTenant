import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import prisma, {
  cleanupTestTenant,
  seedTestTenant,
} from '../common/test/prisma-test';

type ScheduleResponse = {
  id: string;
  tenantId: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
};

describe('Schedules', () => {
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
  beforeEach(async () => {
    await cleanupTestTenant('classes-a');
    await cleanupTestTenant('classes-b');
  });

  afterEach(async () => {
    await cleanupTestTenant('schedule-a');
    await cleanupTestTenant('schedule-b');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a schedule successfully', async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    const response = await request(app.getHttpServer())
      .post('/schedules')
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .send({
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:30',
        room: 'Room 201',
      })
      .expect(201);

    const body = response.body as ScheduleResponse;

    expect(body).toMatchObject({
      tenantId: owner.tenantId,
      classId: klass.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      room: 'Room 201',
    });

    const persisted = await prisma.schedule.findUnique({
      where: { id: body.id },
    });

    expect(persisted).not.toBeNull();
    expect(persisted?.tenantId).toBe(owner.tenantId);
  });

  it('finds all schedules ordered by dayOfWeek then startTime', async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    const created = await Promise.all([
      prisma.schedule.create({
        data: {
          tenantId: owner.tenantId,
          classId: klass.id,
          dayOfWeek: 3,
          startTime: '15:00',
          endTime: '16:00',
        },
      }),
      prisma.schedule.create({
        data: {
          tenantId: owner.tenantId,
          classId: klass.id,
          dayOfWeek: 1,
          startTime: '14:00',
          endTime: '15:00',
        },
      }),
      prisma.schedule.create({
        data: {
          tenantId: owner.tenantId,
          classId: klass.id,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '10:00',
        },
      }),
      prisma.schedule.create({
        data: {
          tenantId: owner.tenantId,
          classId: klass.id,
          dayOfWeek: 2,
          startTime: '11:00',
          endTime: '12:00',
        },
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get('/schedules')
      .query({ classId: klass.id })
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .expect(200);

    const body = response.body as ScheduleResponse[];

    expect(body.map(({ id }) => id)).toEqual([
      created[2].id,
      created[1].id,
      created[3].id,
      created[0].id,
    ]);
  });

  it('finds one schedule by id', async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    const schedule = await prisma.schedule.create({
      data: {
        tenantId: owner.tenantId,
        classId: klass.id,
        dayOfWeek: 2,
        startTime: '13:00',
        endTime: '14:00',
        room: 'Room 101',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/schedules/${schedule.id}`)
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .expect(200);

    expect(response.body as ScheduleResponse).toMatchObject({
      id: schedule.id,
      tenantId: owner.tenantId,
      classId: klass.id,
      room: 'Room 101',
    });
  });

  it("updates only a schedule's room", async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    const schedule = await prisma.schedule.create({
      data: {
        tenantId: owner.tenantId,
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
        room: 'Old Room',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/schedules/${schedule.id}`)
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .send({ room: 'New Room' })
      .expect(200);

    expect(response.body as ScheduleResponse).toMatchObject({
      id: schedule.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      room: 'New Room',
    });
  });

  it('updates only endTime when the merged time range is valid', async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    const schedule = await prisma.schedule.create({
      data: {
        tenantId: owner.tenantId,
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/schedules/${schedule.id}`)
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .send({ endTime: '10:30' })
      .expect(200);

    expect(response.body as ScheduleResponse).toMatchObject({
      id: schedule.id,
      startTime: '09:00',
      endTime: '10:30',
    });
  });

  it('deletes a schedule', async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    const schedule = await prisma.schedule.create({
      data: {
        tenantId: owner.tenantId,
        classId: klass.id,
        dayOfWeek: 4,
        startTime: '17:00',
        endTime: '18:00',
      },
    });

    await request(app.getHttpServer())
      .delete(`/schedules/${schedule.id}`)
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .expect(200);

    await expect(
      prisma.schedule.findUnique({ where: { id: schedule.id } }),
    ).resolves.toBeNull();
  });

  it.each([
    ['equal', '10:00', '10:00'],
    ['later', '11:00', '10:00'],
  ])(
    'rejects creation when startTime is %s to endTime',
    async (_case, startTime, endTime) => {
      const { owner, klass } = await seedTestTenant('schedule-a');

      await request(app.getHttpServer())
        .post('/schedules')
        .set('x-tenant-slug', 'schedule-a')
        .set('x-user-id', owner.id)
        .send({
          classId: klass.id,
          dayOfWeek: 1,
          startTime,
          endTime,
        })
        .expect(400);

      const count = await prisma.schedule.count({
        where: {
          tenantId: owner.tenantId,
          classId: klass.id,
        },
      });

      expect(count).toBe(0);
    },
  );

  it('rejects creation when a schedule overlaps on the same day', async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    await prisma.schedule.create({
      data: {
        tenantId: owner.tenantId,
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '11:00',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/schedules')
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .send({
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '12:00',
      })
      .expect(400);

    expect((response.body as { message: string }).message).toContain(
      'Schedule overlaps',
    );
  });

  it('allows adjacent schedule slots', async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    await prisma.schedule.create({
      data: {
        tenantId: owner.tenantId,
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/schedules')
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .send({
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '11:00',
      })
      .expect(201);

    expect(response.body as ScheduleResponse).toMatchObject({
      startTime: '10:00',
      endTime: '11:00',
    });
  });

  it('allows a room-only update without triggering self-overlap', async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    const schedule = await prisma.schedule.create({
      data: {
        tenantId: owner.tenantId,
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
        room: 'Room A',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/schedules/${schedule.id}`)
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .send({ room: 'Room B' })
      .expect(200);

    expect((response.body as ScheduleResponse).room).toBe('Room B');
  });

  it('rejects an update that overlaps a different schedule', async () => {
    const { owner, klass } = await seedTestTenant('schedule-a');

    await prisma.schedule.create({
      data: {
        tenantId: owner.tenantId,
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
      },
    });

    const target = await prisma.schedule.create({
      data: {
        tenantId: owner.tenantId,
        classId: klass.id,
        dayOfWeek: 1,
        startTime: '11:00',
        endTime: '12:00',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/schedules/${target.id}`)
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', owner.id)
      .send({ startTime: '09:30', endTime: '11:30' })
      .expect(400);

    expect((response.body as { message: string }).message).toContain(
      'Schedule overlaps',
    );
  });

  it('prevents tenant A from reading tenant B schedule', async () => {
    const { owner: ownerA } = await seedTestTenant('schedule-a');
    const { owner: ownerB, klass: classB } = await seedTestTenant('schedule-b');

    const scheduleB = await prisma.schedule.create({
      data: {
        tenantId: ownerB.tenantId,
        classId: classB.id,
        dayOfWeek: 2,
        startTime: '13:00',
        endTime: '14:00',
      },
    });

    await request(app.getHttpServer())
      .get(`/schedules/${scheduleB.id}`)
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', ownerA.id)
      .expect(404);
  });

  it('prevents tenant A from updating tenant B schedule', async () => {
    const { owner: ownerA } = await seedTestTenant('schedule-a');
    const { owner: ownerB, klass: classB } = await seedTestTenant('schedule-b');

    const scheduleB = await prisma.schedule.create({
      data: {
        tenantId: ownerB.tenantId,
        classId: classB.id,
        dayOfWeek: 2,
        startTime: '13:00',
        endTime: '14:00',
        room: 'Tenant B Room',
      },
    });

    await request(app.getHttpServer())
      .patch(`/schedules/${scheduleB.id}`)
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', ownerA.id)
      .send({ room: 'Compromised Room' })
      .expect(404);

    const unchanged = await prisma.schedule.findUnique({
      where: { id: scheduleB.id },
    });

    expect(unchanged?.room).toBe('Tenant B Room');
  });

  it('prevents tenant A from deleting tenant B schedule', async () => {
    const { owner: ownerA } = await seedTestTenant('schedule-a');
    const { owner: ownerB, klass: classB } = await seedTestTenant('schedule-b');

    const scheduleB = await prisma.schedule.create({
      data: {
        tenantId: ownerB.tenantId,
        classId: classB.id,
        dayOfWeek: 2,
        startTime: '13:00',
        endTime: '14:00',
      },
    });

    await request(app.getHttpServer())
      .delete(`/schedules/${scheduleB.id}`)
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', ownerA.id)
      .expect(404);

    const persisted = await prisma.schedule.findUnique({
      where: { id: scheduleB.id },
    });

    expect(persisted).not.toBeNull();
  });

  it('prevents tenant A from creating a schedule on tenant B class', async () => {
    const { owner: ownerA } = await seedTestTenant('schedule-a');
    const { klass: classB } = await seedTestTenant('schedule-b');

    await request(app.getHttpServer())
      .post('/schedules')
      .set('x-tenant-slug', 'schedule-a')
      .set('x-user-id', ownerA.id)
      .send({
        classId: classB.id,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(404);

    const count = await prisma.schedule.count({
      where: { classId: classB.id },
    });

    expect(count).toBe(0);
  });
});
