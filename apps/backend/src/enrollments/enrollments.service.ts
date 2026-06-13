// apps/backend/src/enrollments/enrollments.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, classId: string) {
    // Verify both user and class belong to the same tenant
    const [user, klass] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, tenantId } }),
      this.prisma.class.findFirst({ where: { id: classId, tenantId } }),
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

    return this.prisma.enrollment.create({
      data: { tenantId, userId, classId },
    });
  }
}
