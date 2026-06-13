// apps/frontend/proxy.ts
import { NextRequest, NextResponse } from "next/server";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "edutenant.kr";

function extractSlug(hostname: string): string | null {
  // Strip port for local dev: "math-elite.localhost:3000" → "math-elite.localhost"
  const host = hostname.split(":")[0];
  console.log(`Extracting tenant slug from host: ${host}`);

  // Exact base domain or www → root (marketing/login pages)
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) return null;

  // Local dev: anything.localhost
  if (host.endsWith(".localhost")) {
    return host.replace(".localhost", "");
  }

  // Production: anything.edutenant.kr
  if (host.endsWith(`.${BASE_DOMAIN}`)) {
    return host.replace(`.${BASE_DOMAIN}`, "");
  }

  return null;
}

export function proxy(req: NextRequest) {
  const hostname = req.headers.get("host") ?? "";
  const slug = extractSlug(hostname);

  const res = NextResponse.next();

  if (slug) {
    res.headers.set("x-tenant-slug", slug);
  }

  // Always forward the full hostname for server components that need it
  res.headers.set("x-forwarded-host", hostname);

  return res;
}

export const config = {
  // Run on every route except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
