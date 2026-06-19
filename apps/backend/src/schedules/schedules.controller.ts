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
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @Roles(Role.OWNER, Role.INSTRUCTOR, Role.PARENT, Role.STUDENT)
  findAllByClass(
    @TenantId() tenantId: string,
    @Query('classId') classId: string,
  ) {
    return this.schedulesService.findAllByClass(tenantId, classId);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.INSTRUCTOR, Role.PARENT, Role.STUDENT)
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.schedulesService.findOne(tenantId, id);
  }

  @Post()
  @Roles(Role.OWNER, Role.INSTRUCTOR)
  create(@TenantId() tenantId: string, @Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.INSTRUCTOR)
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.schedulesService.remove(tenantId, id);
  }
}
