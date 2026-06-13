import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.class.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        instructor: {
          select: { id: true, name: true, email: true, role: true },
        },
        schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        _count: { select: { enrollments: true } },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const klass = await this.prisma.class.findFirst({
      where: { id, tenantId },
      include: {
        instructor: {
          select: { id: true, name: true, email: true, role: true },
        },
        schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        enrollments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { enrolledAt: 'desc' },
        },
      },
    });

    if (!klass) throw new NotFoundException(`Class ${id} not found`);
    return klass;
  }

  async create(tenantId: string, dto: CreateClassDto) {
    await this.ensureInstructorBelongsToTenant(tenantId, dto.instructorId);

    return this.prisma.class.create({
      data: {
        tenantId,
        name: dto.name,
        subject: dto.subject,
        instructorId: dto.instructorId,
        maxStudents: dto.maxStudents,
        schedules: dto.schedules?.length
          ? {
              create: dto.schedules.map((schedule) => ({
                tenantId,
                dayOfWeek: schedule.dayOfWeek,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                room: schedule.room,
              })),
            }
          : undefined,
      },
      include: {
        instructor: {
          select: { id: true, name: true, email: true, role: true },
        },
        schedules: true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateClassDto) {
    await this.ensureClassBelongsToTenant(tenantId, id);

    if (dto.instructorId) {
      await this.ensureInstructorBelongsToTenant(tenantId, dto.instructorId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.schedules) {
        await tx.schedule.deleteMany({ where: { tenantId, classId: id } });
      }

      return tx.class.update({
        where: { id },
        data: {
          name: dto.name,
          subject: dto.subject,
          instructorId: dto.instructorId,
          maxStudents: dto.maxStudents,
          schedules: dto.schedules?.length
            ? {
                create: dto.schedules.map((schedule) => ({
                  tenantId,
                  dayOfWeek: schedule.dayOfWeek,
                  startTime: schedule.startTime,
                  endTime: schedule.endTime,
                  room: schedule.room,
                })),
              }
            : undefined,
        },
        include: {
          instructor: {
            select: { id: true, name: true, email: true, role: true },
          },
          schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    await this.ensureClassBelongsToTenant(tenantId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.schedule.deleteMany({ where: { tenantId, classId: id } });
      return tx.class.delete({ where: { id } });
    });
  }

  private async ensureClassBelongsToTenant(tenantId: string, id: string) {
    const klass = await this.prisma.class.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!klass) throw new NotFoundException(`Class ${id} not found`);
  }

  private async ensureInstructorBelongsToTenant(
    tenantId: string,
    instructorId: string,
  ) {
    const instructor = await this.prisma.user.findFirst({
      where: {
        id: instructorId,
        tenantId,
        role: { in: ['OWNER', 'INSTRUCTOR'] },
      },
      select: { id: true },
    });

    if (!instructor) {
      throw new BadRequestException(
        `Instructor ${instructorId} does not belong to this tenant`,
      );
    }
  }
}
