// apps/backend/src/common/decorators/tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Usage: @TenantId() tenantId: string
export const TenantId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest<Request>().tenantId;
  },
);

// Usage: @Tenant() tenant: TenantContext
export const Tenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest<Request>().tenant;
  },
);
