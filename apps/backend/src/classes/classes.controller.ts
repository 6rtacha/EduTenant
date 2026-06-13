import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.classesService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.classesService.findOne(tenantId, id);
  }

  @Roles(Role.OWNER, Role.INSTRUCTOR)
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateClassDto) {
    return this.classesService.create(tenantId, dto);
  }

  @Roles(Role.OWNER, Role.INSTRUCTOR)
  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(tenantId, id, dto);
  }

  @Roles(Role.OWNER)
  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.classesService.remove(tenantId, id);
  }
}
