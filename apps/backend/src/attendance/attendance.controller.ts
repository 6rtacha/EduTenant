import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import type { CurrentUserContext } from '../common/interfaces/tenant.interface';
import { AttendanceService } from './attendance.service';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { ListAttendanceDto } from './dto/list-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @Roles(Role.OWNER, Role.INSTRUCTOR, Role.PARENT, Role.STUDENT)
  findAll(@TenantId() tenantId: string, @Query() query: ListAttendanceDto) {
    return this.attendanceService.findAll(tenantId, query);
  }

  @Post('bulk')
  @Roles(Role.OWNER, Role.INSTRUCTOR)
  bulkMark(
    @TenantId() tenantId: string,
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() dto: BulkMarkAttendanceDto,
  ) {
    return this.attendanceService.bulkMark(tenantId, currentUser, dto);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.INSTRUCTOR, Role.PARENT, Role.STUDENT)
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.attendanceService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.INSTRUCTOR)
  update(
    @TenantId() tenantId: string,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(tenantId, currentUser, id, dto);
  }
}
