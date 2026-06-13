import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUserContext } from '../interfaces/tenant.interface';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUserContext => {
    return ctx.switchToHttp().getRequest<Request>().user!;
  },
);
