// apps/backend/src/tenants/tenants.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';
import { SkipAuth } from '../common/decorators/skip-auth.decorator';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // Public — no tenant context needed to create one
  @SkipTenant()
  @SkipAuth()
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  // Public auth-wise — resolves metadata for the current tenant subdomain.
  @SkipAuth()
  @Get('me')
  getMyTenant(@TenantId() tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }
}
