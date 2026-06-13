// apps/backend/src/common/guards/tenant.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';
import { SKIP_TENANT_KEY } from '../decorators/skip-tenant.decorator';
import type { Request } from 'express';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const slug = req.headers['x-tenant-slug'];

    if (!slug || Array.isArray(slug)) {
      throw new ForbiddenException('Missing x-tenant-slug header');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, plan: true },
    });

    if (!tenant) {
      throw new ForbiddenException(`Tenant "${slug}" not found`);
    }

    req.tenant = tenant; // attach full tenant object
    req.tenantId = tenant.id; // shortcut for convenience
    return true;
  }
}
