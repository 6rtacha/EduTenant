import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Read ────────────────────────────────────────────────────────────────

  async findAllByClass(tenantId: string, classId: string) {
    await this.ensureClassBelongsToTenant(tenantId, classId);

    return this.prisma.schedule.findMany({
      where: { tenantId, classId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id, tenantId },
    });

    if (!schedule) throw new NotFoundException(`Schedule ${id} not found`);
    return schedule;
  }

  // ── Create ──────────────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateScheduleDto) {
    await this.ensureClassBelongsToTenant(tenantId, dto.classId);
    await this.ensureNoOverlap(
      tenantId,
      dto.classId,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
    );

    return this.prisma.schedule.create({
      data: {
        tenantId,
        classId: dto.classId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room,
      },
    });
  }

  // ── Update ──────────────────────────────────────────────────────────────

  async update(tenantId: string, id: string, dto: UpdateScheduleDto) {
    const existing = await this.findOne(tenantId, id);

    // Merge incoming fields with existing values so partial updates
    // still pass the startTime < endTime check
    const merged = {
      dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek,
      startTime: dto.startTime ?? existing.startTime,
      endTime: dto.endTime ?? existing.endTime,
    };

    if (merged.startTime >= merged.endTime) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }

    // Check overlap, excluding the schedule being updated
    await this.ensureNoOverlap(
      tenantId,
      existing.classId,
      merged.dayOfWeek,
      merged.startTime,
      merged.endTime,
      id, // excludeId
    );

    return this.prisma.schedule.update({
      where: { id },
      data: {
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room,
      },
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // confirms existence + tenant ownership

    return this.prisma.schedule.delete({ where: { id } });
  }

  // ── Guards ──────────────────────────────────────────────────────────────

  private async ensureClassBelongsToTenant(tenantId: string, classId: string) {
    const klass = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      select: { id: true },
    });

    if (!klass) {
      throw new NotFoundException(`Class ${classId} not found`);
    }
  }

  private async ensureNoOverlap(
    tenantId: string,
    classId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ) {
    // Two time ranges [A, B] and [C, D] overlap when A < D && C < B
    const overlapping = await this.prisma.schedule.findFirst({
      where: {
        tenantId,
        classId,
        dayOfWeek,
        id: excludeId ? { not: excludeId } : undefined,
        // existing.startTime < incoming endTime
        startTime: { lt: endTime },
        // existing.endTime > incoming startTime
        endTime: { gt: startTime },
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Schedule overlaps with an existing slot on day ${dayOfWeek} (${overlapping.startTime}–${overlapping.endTime})`,
      );
    }
  }
}
