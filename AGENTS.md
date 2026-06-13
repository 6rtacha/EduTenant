# EduTenant Agent Guide

## Project Identity

This project is **EduTenant**. Older notes may call it **EduHub Korea**; treat that as the previous name and use EduTenant in new code, comments, docs, UI copy, domains, and examples unless a legacy file must remain unchanged.

EduTenant is a multi-tenant B2B SaaS platform for Korean hagwons. Each academy is a tenant with isolated data and a subdomain such as `math-elite.edutenant.kr` or `math-elite.localhost` in local development. The product scope includes classes, enrollment, attendance, homework, payments, notices, parent/student relationships, role-based dashboards, and tenant-scoped administration.

## Current Repository Reality

- The root directory is not currently a Git repository, though `apps/frontend` and `apps/backend` contain their own `.git` directories. Check the active working tree before assuming repository-level Git commands work.
- The onboarding document describes a later intended state, but this checkout appears closer to the multi-tenancy foundation. Do not assume auth, controllers, DTOs, or Phase 3 files exist until you inspect the repo.
- The onboarding plan says pnpm workspaces, but this checkout currently has `package-lock.json` files and npm-style workspaces. Do not convert package managers or lockfiles unless explicitly asked.
- `node_modules` and backend `dist` artifacts are present. Ignore generated/vendor output unless the task is specifically about dependency or build output issues.

## Architecture

- Monorepo shape:
  - `apps/frontend`: Next.js App Router frontend.
  - `apps/backend`: NestJS backend.
  - `apps/backend/prisma/schema.prisma`: source of truth for the main Prisma schema.
  - `prisma/seed.ts`: root seed script.
- Frontend local dev runs on port `3001`; backend local dev runs on port `3002` via the root npm scripts.
- Production domain examples should use `edutenant.kr`, not `eduhub.kr`.
- Local tenant subdomains should use patterns like `math-elite.localhost:3001`.

## Multi-Tenancy Invariants

Tenant isolation is the highest-priority invariant.

- Every tenant-owned Prisma model must include `tenantId`.
- Every tenant-owned model should have `@@index([tenantId])`.
- Unique constraints should include `tenantId` whenever uniqueness is tenant-local.
- Never query, update, delete, aggregate, or count tenant-owned data without tenant scoping.
- Service methods that touch tenant-owned data should receive `tenantId` as the first argument.
- Validate cross-entity ownership in the service layer. For example, before creating an enrollment, confirm the class and user both belong to the same tenant.
- Tests for tenant-owned features should include two tenants and prove that data does not cross tenant boundaries.

## Backend Conventions

- Framework: NestJS with strict TypeScript.
- ORM: Prisma with PostgreSQL.
- Keep feature modules sliced by domain, for example `tenants/`, `classes/`, `enrollments/`, `attendance/`, `homework/`, `payments/`, `notices/`, and `auth/`.
- `TenantGuard` is registered globally as an `APP_GUARD`; new protected controllers should not re-register it.
- Public backend routes must use `@SkipTenant()`.
- Prefer `@TenantId()` and `@CurrentUser()` style decorators in controllers when those decorators exist. Do not reach into `req.tenantId` or `req.user` from controllers unless the current code has not introduced the decorator yet.
- DTOs should use `class-validator` decorators. Optional DTO fields should combine `@IsOptional()` with TypeScript `?:`.
- Keep validation compatible with the global `ValidationPipe` expectation: whitelist enabled, non-whitelisted fields forbidden, and transform enabled.
- Avoid `any`. If it is unavoidable, keep it local and explain why.
- Prisma access should go through `PrismaService`.

## Frontend Conventions

- Use Next.js App Router conventions under `app/`.
- Prefer Server Components. Add `"use client"` only when interactivity, browser APIs, or client-side hooks require it.
- Preserve the frontend-specific guidance in `apps/frontend/AGENTS.md`: inspect the installed Next.js documentation in `node_modules/next/dist/docs/` before relying on memory for framework behavior.
- Tenant resolution is based on the `Host` header in the Next.js `proxy.ts` file. Preserve forwarding of tenant context such as `x-tenant-slug` and `x-forwarded-host`.
- When the backend API client exists, use the shared client helper for frontend-to-backend calls instead of raw `fetch` with hand-written tenant/auth headers.
- When tenant helpers exist, do tenant lookup and role gating in layouts or top-level route boundaries rather than scattered inside leaf components.
- The product is Korean-first. Prefer `next-intl` or the existing i18n pattern when present; avoid hardcoded Korean strings in general product components unless the current area has no i18n infrastructure yet.
- For frontend UI, keep SaaS screens dense, calm, and task-focused. Avoid marketing-style hero layouts for operational dashboards.

## Auth And Roles

The intended auth architecture uses OAuth providers Kakao and Naver, Auth.js on the frontend, and Passport/JWT-style guards on the backend. In this checkout, verify the actual auth files before depending on them.

Intended role rules:

- First user in a tenant becomes `OWNER`.
- Later users default to `STUDENT` until changed by an owner/admin workflow.
- The same OAuth identity signing into two tenants should create two tenant-scoped user records.
- Role checks must also enforce `req.user.tenantId === req.tenantId` or the equivalent defense-in-depth check.

Do not weaken these rules for convenience.

## Data Model Notes

Core roles are `OWNER`, `INSTRUCTOR`, `PARENT`, and `STUDENT`.

Important tenant-owned domains include:

- tenants and users
- classes and schedules
- enrollments
- attendance
- homework and homework submissions
- payments
- notices
- parent/student relationships

Before adding a field or enum value, inspect `apps/backend/prisma/schema.prisma` and existing migrations. Keep schema, generated client usage, tests, and DTO validation in sync.

## Commands

Because the checkout currently contains npm lockfiles, prefer these commands unless the package-manager setup is intentionally changed:

- Root install: `npm install`
- Frontend dev: `npm --workspace frontend run dev`
- Frontend build: `npm --workspace frontend run build`
- Frontend lint: `npm --workspace frontend run lint`
- Backend dev: `npm --workspace backend run start:dev`
- Backend build: `npm --workspace backend run build`
- Backend unit tests: `npm --workspace backend test`
- Backend e2e tests: `npm --workspace backend run test:e2e`
- Backend lint: `npm --workspace backend run lint`

If the project is migrated to pnpm, update this file and then prefer:

- `pnpm --filter frontend <script>`
- `pnpm --filter backend <script>`

## Testing Expectations

- Add or update tests for behavior changes, especially tenant isolation, auth/roles, and cross-entity ownership.
- Backend e2e tests belong in `apps/backend/test/`.
- Backend unit tests should be co-located as `*.spec.ts`.
- Backend tests default to the local Docker Postgres URL in `apps/backend/.env.test.example`; start it with `npm run db:test:up` and migrate with `npm run db:test:migrate`.
- Tenant-isolation tests should seed at least two tenants and assert that tenant A cannot read or mutate tenant B data.
- Clean up test data with scoped deletes using known test tenant IDs.
- Run the narrowest relevant checks first, then broader checks when the change touches shared behavior.

## Phase Guidance

The intended next major product phase is core SaaS functionality:

- Classes CRUD with instructor assignment and schedule support.
- Enrollment and unenrollment flows with status management and capacity checks.
- Attendance marking, bulk attendance, and history.
- Homework creation, submission, and grading.
- Per-role dashboards.
- Tenant-scoped user management and role changes.

Before implementing Phase 4 work, confirm whether Phase 3 auth wiring exists in the current checkout. If it does not, call that out and either implement the missing prerequisite or keep the change scoped to the current foundation.

## Safety And Review

- Preserve tenant isolation over speed.
- Do not add production dependencies without a clear reason.
- Do not commit secrets. Environment files should remain local.
- Do not make destructive Git or filesystem changes unless explicitly requested.
- Keep generated files, lockfiles, and build artifacts untouched unless the task requires them.
- When finishing a change, summarize what changed, what was verified, and any project-state mismatch that affected the work.
