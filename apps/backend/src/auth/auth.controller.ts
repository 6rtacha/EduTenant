import { Body, Controller, Get, Post } from '@nestjs/common';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipAuth } from '../common/decorators/skip-auth.decorator';
import type { CurrentUserContext } from '../common/interfaces/tenant.interface';
import { AuthService } from './auth.service';
import { OAuthSignInDto } from './dto/oauth-sign-in.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @SkipAuth()
  @Post('oauth')
  signInWithOAuth(@TenantId() tenantId: string, @Body() dto: OAuthSignInDto) {
    return this.authService.signInWithOAuth(tenantId, dto);
  }

  @Get('me')
  me(@CurrentUser() user: CurrentUserContext) {
    return user;
  }
}
