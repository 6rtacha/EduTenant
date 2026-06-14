import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListEnrollmentsDto } from './dto/list-enrollments.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListEnrollmentsDto) {
    return this.prisma.enrollment.findMany({
      where: {
        tenantId,
        classId: query.classId,
        userId: query.userId,
        status: query.status,
      },
      orderBy: { enrolledAt: 'desc' },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            subject: true,
            maxStudents: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, tenantId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            subject: true,
            maxStudents: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${id} not found`);
    }

    return enrollment;
  }

  async create(tenantId: string, userId: string, classId: string) {
    const [user, klass] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { id: true, role: true },
      }),
      this.prisma.class.findFirst({
        where: { id: classId, tenantId },
        select: { id: true, maxStudents: true },
      }),
    ]);

    if (!user) {
      throw new BadRequestException(
        `User ${userId} does not belong to this tenant`,
      );
    }

    if (!klass) {
      throw new BadRequestException(
        `Class ${classId} does not belong to this tenant`,
      );
    }

    if (user.role !== 'STUDENT') {
      throw new BadRequestException('Only STUDENT users can be enrolled');
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { tenantId_userId_classId: { tenantId, userId, classId } },
      select: { id: true, status: true },
    });

    if (existing && existing.status !== EnrollmentStatus.WITHDRAWN) {
      throw new ConflictException('User is already enrolled in this class');
    }

    await this.ensureCapacity(tenantId, classId, klass.maxStudents);

    if (existing) {
      return this.prisma.enrollment.update({
        where: { id: existing.id },
        data: { status: EnrollmentStatus.ACTIVE },
        include: {
          class: { select: { id: true, name: true, subject: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
    }

    return this.prisma.enrollment.create({
      data: { tenantId, userId, classId },
      include: {
        class: { select: { id: true, name: true, subject: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async updateStatus(tenantId: string, id: string, status: EnrollmentStatus) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, tenantId },
      include: {
        class: { select: { id: true, maxStudents: true } },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${id} not found`);
    }

    if (
      status === EnrollmentStatus.ACTIVE &&
      enrollment.status !== EnrollmentStatus.ACTIVE
    ) {
      await this.ensureCapacity(
        tenantId,
        enrollment.classId,
        enrollment.class.maxStudents,
      );
    }

    return this.prisma.enrollment.update({
      where: { id },
      data: { status },
      include: {
        class: {
          select: { id: true, name: true, subject: true, maxStudents: true },
        },
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  private async ensureCapacity(
    tenantId: string,
    classId: string,
    maxStudents: number,
  ) {
    const activeCount = await this.prisma.enrollment.count({
      where: {
        tenantId,
        classId,
        status: EnrollmentStatus.ACTIVE,
      },
    });

    if (activeCount >= maxStudents) {
      throw new ConflictException('Class is already at capacity');
    }
  }
}
