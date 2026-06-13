import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipTenant } from './common/decorators/skip-tenant.decorator';
import { SkipAuth } from './common/decorators/skip-auth.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @SkipTenant()
  @SkipAuth()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
