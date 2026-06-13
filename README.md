# EduTenant

EduTenant is a multi-tenant SaaS platform for Korean hagwons. This checkout uses npm workspaces with a Next.js frontend and a NestJS backend.

## NPM Workflow

Run commands from the repository root.

- Frontend dev server: `npm run dev:frontend` (port `3001`)
- Backend dev server: `npm run dev:backend` (port `3002`)
- Frontend build: `npm run build:frontend`
- Backend build: `npm run build:backend`
- Frontend lint: `npm run lint:frontend`
- Backend lint: `npm run lint:backend`

## Local Test Database

Backend tests default to a local PostgreSQL database at:

```text
postgresql://edutenant:edutenant@localhost:5433/edutenant_test?schema=public
```

Start the local test database:

```bash
npm run db:test:up
```

Apply migrations:

```bash
npm run db:test:migrate
```

Run backend tests:

```bash
npm run test:backend
```

Run backend e2e tests:

```bash
npm run test:backend:e2e
```

Stop the local database:

```bash
npm run db:test:down
```

You can override the default test database with `TEST_DATABASE_URL`.
