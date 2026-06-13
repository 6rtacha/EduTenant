// apps/web/app/layout.tsx
import { getCurrentTenant } from "@/lib/tenant";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getCurrentTenant();

  // No tenant slug = root domain = show marketing/login page
  if (!tenant) {
    // You can redirect to a marketing page or render it inline
    // For now just render children (the root domain pages)
    return (
      <html lang="ko">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="ko">
      <body>
        {/* Tenant name in a data attribute for CSS or client components */}
        <div data-tenant={tenant.slug}>{children}</div>
      </body>
    </html>
  );
}
