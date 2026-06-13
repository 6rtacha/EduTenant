import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OAuthSignInDto } from './dto/oauth-sign-in.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signInWithOAuth(tenantId: string, dto: OAuthSignInDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        oauthProvider: dto.provider,
        oauthId: dto.oauthId,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        oauthProvider: true,
        oauthId: true,
      },
    });

    if (existing) return existing;

    const userCount = await this.prisma.user.count({ where: { tenantId } });

    return this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        name: dto.name,
        role: userCount === 0 ? 'OWNER' : 'STUDENT',
        oauthProvider: dto.provider,
        oauthId: dto.oauthId,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        oauthProvider: true,
        oauthId: true,
      },
    });
  }
}
