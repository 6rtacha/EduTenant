import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { SKIP_AUTH_KEY } from '../decorators/skip-auth.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const userId = req.headers['x-user-id'];

    if (!userId || Array.isArray(userId)) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    if (!req.tenantId) {
      throw new ForbiddenException('Missing tenant context');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: req.tenantId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found in this tenant');
    }

    req.user = user;
    return true;
  }
}
