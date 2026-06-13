// apps/backend/src/common/interfaces/tenant.interface.ts
export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface CurrentUserContext {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'OWNER' | 'INSTRUCTOR' | 'PARENT' | 'STUDENT';
}

// Extend Express Request so TypeScript knows about req.tenant
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId: string;
      tenant: TenantContext;
      user?: CurrentUserContext;
    }
  }
}
