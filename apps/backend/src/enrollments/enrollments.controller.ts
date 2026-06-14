import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EnrollmentStatus, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { ListEnrollmentsDto } from './dto/list-enrollments.dto';
import { UpdateEnrollmentStatusDto } from './dto/update-enrollment-status.dto';
import { EnrollmentsService } from './enrollments.service';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @Query() query: ListEnrollmentsDto) {
    return this.enrollmentsService.findAll(tenantId, query);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.enrollmentsService.findOne(tenantId, id);
  }

  @Roles(Role.OWNER, Role.INSTRUCTOR)
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(tenantId, dto.userId, dto.classId);
  }

  @Roles(Role.OWNER, Role.INSTRUCTOR)
  @Patch(':id/status')
  updateStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    return this.enrollmentsService.updateStatus(tenantId, id, dto.status);
  }

  @Roles(Role.OWNER, Role.INSTRUCTOR)
  @Delete(':id')
  withdraw(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.enrollmentsService.updateStatus(
      tenantId,
      id,
      EnrollmentStatus.WITHDRAWN,
    );
  }
}
