import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import prisma, { cleanupTestTenant } from '../common/test/prisma-test';

type AuthUserResponse = {
  id: string;
  tenantId: string;
  role: string;
};

describe('Auth', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await cleanupTestTenant('auth-a');
    await cleanupTestTenant('auth-b');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('assigns OWNER to the first tenant user and STUDENT to later users', async () => {
    await prisma.tenant.create({
      data: { name: 'Auth A', slug: 'auth-a' },
    });

    const owner = await request(app.getHttpServer())
      .post('/auth/oauth')
      .set('x-tenant-slug', 'auth-a')
      .send({
        provider: 'KAKAO',
        oauthId: 'owner-kakao',
        email: 'owner@auth-a.test',
        name: 'Owner',
      })
      .expect(201);

    const student = await request(app.getHttpServer())
      .post('/auth/oauth')
      .set('x-tenant-slug', 'auth-a')
      .send({
        provider: 'NAVER',
        oauthId: 'student-naver',
        email: 'student@auth-a.test',
        name: 'Student',
      })
      .expect(201);

    const ownerBody = owner.body as AuthUserResponse;
    const studentBody = student.body as AuthUserResponse;

    expect(ownerBody.role).toBe('OWNER');
    expect(studentBody.role).toBe('STUDENT');
  });

  it('creates separate tenant-scoped users for the same OAuth identity', async () => {
    await prisma.tenant.createMany({
      data: [
        { name: 'Auth A', slug: 'auth-a' },
        { name: 'Auth B', slug: 'auth-b' },
      ],
    });

    const payload = {
      provider: 'KAKAO',
      oauthId: 'shared-kakao-id',
      email: 'shared@example.com',
      name: 'Shared User',
    };

    const userA = await request(app.getHttpServer())
      .post('/auth/oauth')
      .set('x-tenant-slug', 'auth-a')
      .send(payload)
      .expect(201);

    const userB = await request(app.getHttpServer())
      .post('/auth/oauth')
      .set('x-tenant-slug', 'auth-b')
      .send(payload)
      .expect(201);

    const userABody = userA.body as AuthUserResponse;
    const userBBody = userB.body as AuthUserResponse;

    expect(userABody.id).not.toBe(userBBody.id);
    expect(userABody.tenantId).not.toBe(userBBody.tenantId);
  });

  it('does not authenticate a user outside the active tenant', async () => {
    const tenantA = await prisma.tenant.create({
      data: { name: 'Auth A', slug: 'auth-a' },
    });
    await prisma.tenant.create({ data: { name: 'Auth B', slug: 'auth-b' } });
    const userA = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: 'owner@auth-a.test',
        name: 'Owner',
        role: 'OWNER',
      },
    });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('x-tenant-slug', 'auth-b')
      .set('x-user-id', userA.id)
      .expect(401);
  });
});
