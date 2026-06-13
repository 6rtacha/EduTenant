// apps/web/lib/tenant.ts
import { headers } from "next/headers";
import { cache } from "react";
import { prisma } from "./prisma";

export type TenantContext = {
  id: string;
  name: string;
  slug: string;
  plan: string;
};

/**
 * Reads x-tenant-slug from the request headers and resolves it to a full
 * Tenant record. Wrapped in React's `cache()` so it runs at most once per
 * request — safe to call from multiple server components.
 */
export const getCurrentTenant = cache(
  async (): Promise<TenantContext | null> => {
    const headerList = await headers();
    const slug = headerList.get("x-tenant-slug");

    if (!slug) return null;

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, plan: true },
    });

    return tenant ?? null;
  }
);

/**
 * Use this in layouts/pages that must have a tenant.
 * Throws a hard error (triggers Next.js error boundary) if no tenant found.
 */
export async function requireTenant(): Promise<TenantContext> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    throw new Error("No tenant context — check subdomain routing");
  }
  return tenant;
}
