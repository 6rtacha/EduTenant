import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceStatus, Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import prisma, {
  cleanupTestTenant,
  seedTestTenant,
} from '../common/test/prisma-test';

jest.setTimeout(30_000);

type AttendanceResponse = {
  id: string;
  tenantId: string;
  scheduleId: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  user?: {
    id: string;
    name: string;
  };
};

async function seedAttendanceFixture(slug: string) {
  const fixture = await seedTestTenant(slug);

  const schedule = await prisma.schedule.create({
    data: {
      tenantId: fixture.tenant.id,
      classId: fixture.klass.id,
      dayOfWeek: 1,
      startTime: '14:00',
      endTime: '15:30',
      room: '201',
    },
  });

  await prisma.enrollment.create({
    data: {
      tenantId: fixture.tenant.id,
      classId: fixture.klass.id,
      userId: fixture.student.id,
      status: 'ACTIVE',
    },
  });

  return {
    ...fixture,
    schedule,
  };
}

describe('Attendance', () => {
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
    await cleanupTestTenant('attendance-a');
    await cleanupTestTenant('attendance-b');
  });

  afterEach(async () => {
    await cleanupTestTenant('attendance-a');
    await cleanupTestTenant('attendance-b');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('bulk marks attendance for actively enrolled students', async () => {
    const { tenant, owner, student, klass, schedule } =
      await seedAttendanceFixture('attendance-a');

    const secondStudent = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'second-student@attendance-a.test',
        name: 'Second Student',
        role: Role.STUDENT,
      },
    });

    await prisma.enrollment.create({
      data: {
        tenantId: tenant.id,
        classId: klass.id,
        userId: secondStudent.id,
        status: 'ACTIVE',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .send({
        scheduleId: schedule.id,
        date: '2026-06-22',
        records: [
          {
            userId: student.id,
            status: 'PRESENT',
          },
          {
            userId: secondStudent.id,
            status: 'LATE',
            note: 'Arrived 10 minutes late',
          },
        ],
      })
      .expect(201);

    const body = response.body as AttendanceResponse[];

    expect(body).toHaveLength(2);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: tenant.id,
          scheduleId: schedule.id,
          userId: student.id,
          status: 'PRESENT',
        }),
        expect.objectContaining({
          tenantId: tenant.id,
          scheduleId: schedule.id,
          userId: secondStudent.id,
          status: 'LATE',
          note: 'Arrived 10 minutes late',
        }),
      ]),
    );

    const persisted = await prisma.attendance.count({
      where: {
        tenantId: tenant.id,
        scheduleId: schedule.id,
        date: new Date('2026-06-22T00:00:00.000Z'),
      },
    });

    expect(persisted).toBe(2);
  });

  it('upserts an existing attendance record instead of creating a duplicate', async () => {
    const { tenant, owner, student, schedule } =
      await seedAttendanceFixture('attendance-a');

    const requestBody = {
      scheduleId: schedule.id,
      date: '2026-06-22',
      records: [
        {
          userId: student.id,
          status: 'PRESENT',
        },
      ],
    };

    const created = await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .send(requestBody)
      .expect(201);

    const createdBody = created.body as AttendanceResponse[];

    const updated = await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .send({
        ...requestBody,
        records: [
          {
            userId: student.id,
            status: 'ABSENT',
            note: 'No notice provided',
          },
        ],
      })
      .expect(201);

    const updatedBody = updated.body as AttendanceResponse[];

    expect(updatedBody[0].id).toBe(createdBody[0].id);
    expect(updatedBody[0].status).toBe('ABSENT');
    expect(updatedBody[0].note).toBe('No notice provided');

    const count = await prisma.attendance.count({
      where: {
        tenantId: tenant.id,
        scheduleId: schedule.id,
        userId: student.id,
      },
    });

    expect(count).toBe(1);
  });

  it('lists and finds tenant attendance records', async () => {
    const { tenant, owner, student, klass, schedule } =
      await seedAttendanceFixture('attendance-a');

    const attendance = await prisma.attendance.create({
      data: {
        tenantId: tenant.id,
        scheduleId: schedule.id,
        userId: student.id,
        date: new Date('2026-06-22T00:00:00.000Z'),
        status: 'LATE',
        note: 'Traffic',
      },
    });

    const listResponse = await request(app.getHttpServer())
      .get('/attendance')
      .query({
        classId: klass.id,
        date: '2026-06-22',
        status: 'LATE',
      })
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .expect(200);

    const listBody = listResponse.body as AttendanceResponse[];

    expect(listBody).toHaveLength(1);
    expect(listBody[0]).toMatchObject({
      id: attendance.id,
      tenantId: tenant.id,
      scheduleId: schedule.id,
      userId: student.id,
      status: 'LATE',
      note: 'Traffic',
    });

    const findResponse = await request(app.getHttpServer())
      .get(`/attendance/${attendance.id}`)
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .expect(200);

    expect(findResponse.body as AttendanceResponse).toMatchObject({
      id: attendance.id,
      tenantId: tenant.id,
      userId: student.id,
      status: 'LATE',
    });
  });

  it('updates attendance status and note', async () => {
    const { tenant, owner, student, schedule } =
      await seedAttendanceFixture('attendance-a');

    const attendance = await prisma.attendance.create({
      data: {
        tenantId: tenant.id,
        scheduleId: schedule.id,
        userId: student.id,
        date: new Date('2026-06-22T00:00:00.000Z'),
        status: 'ABSENT',
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/attendance/${attendance.id}`)
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .send({
        status: 'EXCUSED',
        note: 'Medical appointment',
      })
      .expect(200);

    expect(response.body as AttendanceResponse).toMatchObject({
      id: attendance.id,
      status: 'EXCUSED',
      note: 'Medical appointment',
    });
  });

  it('rejects duplicate students in one bulk request', async () => {
    const { owner, student, schedule } =
      await seedAttendanceFixture('attendance-a');

    const response = await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .send({
        scheduleId: schedule.id,
        date: '2026-06-22',
        records: [
          {
            userId: student.id,
            status: 'PRESENT',
          },
          {
            userId: student.id,
            status: 'ABSENT',
          },
        ],
      })
      .expect(400);

    expect((response.body as { message: string }).message).toContain(
      'Each student may appear only once',
    );
  });

  it('rejects a student who is not actively enrolled', async () => {
    const { tenant, owner, klass, schedule } =
      await seedAttendanceFixture('attendance-a');

    const unenrolledStudent = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'unenrolled@attendance-a.test',
        name: 'Unenrolled Student',
        role: Role.STUDENT,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .send({
        scheduleId: schedule.id,
        date: '2026-06-22',
        records: [
          {
            userId: unenrolledStudent.id,
            status: 'PRESENT',
          },
        ],
      })
      .expect(400);

    expect((response.body as { message: string }).message).toContain(
      'not actively enrolled',
    );

    const count = await prisma.attendance.count({
      where: {
        tenantId: tenant.id,
        schedule: { classId: klass.id },
      },
    });

    expect(count).toBe(0);
  });

  it('rejects users who are not students', async () => {
    const { owner, schedule } = await seedAttendanceFixture('attendance-a');

    const response = await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .send({
        scheduleId: schedule.id,
        date: '2026-06-22',
        records: [
          {
            userId: owner.id,
            status: 'PRESENT',
          },
        ],
      })
      .expect(400);

    expect((response.body as { message: string }).message).toContain(
      'Invalid students',
    );
  });

  it('allows the assigned instructor to manage attendance', async () => {
    const { tenant, student, klass, schedule } =
      await seedAttendanceFixture('attendance-a');

    const instructor = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'instructor@attendance-a.test',
        name: 'Instructor',
        role: Role.INSTRUCTOR,
      },
    });

    await prisma.class.update({
      where: { id: klass.id },
      data: { instructorId: instructor.id },
    });

    const response = await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', instructor.id)
      .send({
        scheduleId: schedule.id,
        date: '2026-06-22',
        records: [
          {
            userId: student.id,
            status: 'PRESENT',
          },
        ],
      })
      .expect(201);

    expect(response.body as AttendanceResponse[]).toHaveLength(1);
  });

  it('rejects an instructor who is not assigned to the class', async () => {
    const { tenant, student, schedule } =
      await seedAttendanceFixture('attendance-a');

    const otherInstructor = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'other-instructor@attendance-a.test',
        name: 'Other Instructor',
        role: Role.INSTRUCTOR,
      },
    });

    const response = await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', otherInstructor.id)
      .send({
        scheduleId: schedule.id,
        date: '2026-06-22',
        records: [
          {
            userId: student.id,
            status: 'PRESENT',
          },
        ],
      })
      .expect(403);

    expect((response.body as { message: string }).message).toContain(
      'cannot manage attendance',
    );
  });

  it('prevents students from marking attendance', async () => {
    const { student, schedule } = await seedAttendanceFixture('attendance-a');

    await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', student.id)
      .send({
        scheduleId: schedule.id,
        date: '2026-06-22',
        records: [
          {
            userId: student.id,
            status: 'PRESENT',
          },
        ],
      })
      .expect(403);
  });

  it('prevents tenant A from using tenant B schedule', async () => {
    const { owner: ownerA, student: studentA } =
      await seedAttendanceFixture('attendance-a');

    const { schedule: scheduleB } = await seedAttendanceFixture('attendance-b');

    await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', ownerA.id)
      .send({
        scheduleId: scheduleB.id,
        date: '2026-06-22',
        records: [
          {
            userId: studentA.id,
            status: 'PRESENT',
          },
        ],
      })
      .expect(404);
  });

  it('prevents tenant A from reading or updating tenant B attendance', async () => {
    const { owner: ownerA } = await seedAttendanceFixture('attendance-a');

    const {
      tenant: tenantB,
      student: studentB,
      schedule: scheduleB,
    } = await seedAttendanceFixture('attendance-b');

    const attendanceB = await prisma.attendance.create({
      data: {
        tenantId: tenantB.id,
        scheduleId: scheduleB.id,
        userId: studentB.id,
        date: new Date('2026-06-22T00:00:00.000Z'),
        status: 'PRESENT',
      },
    });

    await request(app.getHttpServer())
      .get(`/attendance/${attendanceB.id}`)
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', ownerA.id)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/attendance/${attendanceB.id}`)
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', ownerA.id)
      .send({ status: 'ABSENT' })
      .expect(404);

    const unchanged = await prisma.attendance.findUnique({
      where: { id: attendanceB.id },
    });

    expect(unchanged?.status).toBe('PRESENT');
  });

  it('rejects invalid dates and unknown request fields', async () => {
    const { owner, student, schedule } =
      await seedAttendanceFixture('attendance-a');

    await request(app.getHttpServer())
      .post('/attendance/bulk')
      .set('x-tenant-slug', 'attendance-a')
      .set('x-user-id', owner.id)
      .send({
        scheduleId: schedule.id,
        date: '22-06-2026',
        tenantId: owner.tenantId,
        records: [
          {
            userId: student.id,
            status: 'PRESENT',
          },
        ],
      })
      .expect(400);
  });
});
