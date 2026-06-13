// apps/backend/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { SkipAuth } from '../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';

@Controller('health')
export class HealthController {
  @SkipTenant()
  @SkipAuth()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
