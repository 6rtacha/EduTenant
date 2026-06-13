import { OAuthProvider } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class OAuthSignInDto {
  @IsEnum(OAuthProvider)
  provider: OAuthProvider;

  @IsString()
  @IsNotEmpty()
  oauthId: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
