import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, Role } from '@prisma/client';
import { CurrentUserContext } from '../common/interfaces/tenant.interface';
import { PrismaService } from '../prisma/prisma.service';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { ListAttendanceDto } from './dto/list-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListAttendanceDto) {
    return this.prisma.attendance.findMany({
      where: {
        tenantId,
        scheduleId: query.scheduleId,
        userId: query.userId,
        status: query.status,
        date: query.date ? this.parseDate(query.date) : undefined,
        schedule: query.classId
          ? {
              classId: query.classId,
            }
          : undefined,
      },
      orderBy: [
        { date: 'desc' },
        { schedule: { dayOfWeek: 'asc' } },
        { schedule: { startTime: 'asc' } },
      ],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        schedule: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                subject: true,
                instructorId: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        schedule: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                subject: true,
                instructorId: true,
              },
            },
          },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException(`Attendance ${id} not found`);
    }

    return attendance;
  }

  async bulkMark(
    tenantId: string,
    currentUser: CurrentUserContext,
    dto: BulkMarkAttendanceDto,
  ) {
    const schedule = await this.prisma.schedule.findFirst({
      where: {
        id: dto.scheduleId,
        tenantId,
      },
      include: {
        class: {
          select: {
            id: true,
            instructorId: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule ${dto.scheduleId} not found`);
    }

    this.ensureCanManageClass(currentUser, schedule.class.instructorId);

    const userIds = dto.records.map((record) => record.userId);
    const uniqueUserIds = [...new Set(userIds)];

    if (uniqueUserIds.length !== userIds.length) {
      throw new BadRequestException(
        'Each student may appear only once in an attendance request',
      );
    }

    const students = await this.prisma.user.findMany({
      where: {
        tenantId,
        id: { in: uniqueUserIds },
        role: Role.STUDENT,
      },
      select: { id: true },
    });

    const validStudentIds = new Set(students.map((student) => student.id));

    const invalidUserIds = uniqueUserIds.filter(
      (userId) => !validStudentIds.has(userId),
    );

    if (invalidUserIds.length > 0) {
      throw new BadRequestException(
        `Invalid students for this tenant: ${invalidUserIds.join(', ')}`,
      );
    }

    const activeEnrollments = await this.prisma.enrollment.findMany({
      where: {
        tenantId,
        classId: schedule.classId,
        userId: { in: uniqueUserIds },
        status: EnrollmentStatus.ACTIVE,
      },
      select: { userId: true },
    });

    const enrolledUserIds = new Set(
      activeEnrollments.map((enrollment) => enrollment.userId),
    );

    const unenrolledUserIds = uniqueUserIds.filter(
      (userId) => !enrolledUserIds.has(userId),
    );

    if (unenrolledUserIds.length > 0) {
      throw new BadRequestException(
        `Students are not actively enrolled in this class: ${unenrolledUserIds.join(
          ', ',
        )}`,
      );
    }

    const date = this.parseDate(dto.date);

    return this.prisma.$transaction(
      dto.records.map((record) =>
        this.prisma.attendance.upsert({
          where: {
            tenantId_scheduleId_userId_date: {
              tenantId,
              scheduleId: schedule.id,
              userId: record.userId,
              date,
            },
          },
          create: {
            tenantId,
            scheduleId: schedule.id,
            userId: record.userId,
            date,
            status: record.status,
            note: record.note,
          },
          update: {
            status: record.status,
            note: record.note ?? null,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        }),
      ),
    );
  }

  async update(
    tenantId: string,
    currentUser: CurrentUserContext,
    id: string,
    dto: UpdateAttendanceDto,
  ) {
    const existing = await this.prisma.attendance.findFirst({
      where: { id, tenantId },
      include: {
        schedule: {
          include: {
            class: {
              select: {
                instructorId: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Attendance ${id} not found`);
    }

    this.ensureCanManageClass(
      currentUser,
      existing.schedule.class.instructorId,
    );

    return this.prisma.attendance.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        note: dto.note,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        schedule: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                subject: true,
                instructorId: true,
              },
            },
          },
        },
      },
    });
  }

  private ensureCanManageClass(
    currentUser: CurrentUserContext,
    instructorId: string,
  ) {
    if (currentUser.role === Role.OWNER) {
      return;
    }

    if (
      currentUser.role === Role.INSTRUCTOR &&
      currentUser.id === instructorId
    ) {
      return;
    }

    throw new ForbiddenException('You cannot manage attendance for this class');
  }

  private parseDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }
}
