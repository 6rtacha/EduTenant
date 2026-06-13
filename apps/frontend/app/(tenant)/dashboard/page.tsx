// apps/web/app/(tenant)/dashboard/page.tsx
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const tenant = await requireTenant();
  console.log(`Loading dashboard for tenant ${tenant.name} (${tenant.slug})`);

  const [classCount, studentCount] = await Promise.all([
    prisma.class.count({ where: { tenantId: tenant.id } }),
    prisma.user.count({ where: { tenantId: tenant.id, role: "STUDENT" } }),
  ]);

  return (
    <div>
      <h1>{tenant.name} 대시보드</h1>
      <p>반 수: {classCount}</p>
      <p>학생 수: {studentCount}</p>
    </div>
  );
}
