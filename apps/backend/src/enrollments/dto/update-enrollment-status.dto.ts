import { EnrollmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateEnrollmentStatusDto {
  @IsEnum(EnrollmentStatus)
  status: EnrollmentStatus;
}
