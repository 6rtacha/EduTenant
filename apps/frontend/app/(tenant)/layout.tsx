// apps/web/app/(tenant)/layout.tsx
import { requireTenant } from "@/lib/tenant";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await requireTenant();

  return (
    <div>
      {/* Tenant nav, branding etc — tenant.name is available here */}
      <header>
        <span>{tenant.name}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
