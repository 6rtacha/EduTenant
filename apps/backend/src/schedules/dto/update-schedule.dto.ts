import {
  IsInt,
  IsMilitaryTime,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IsBeforeEndTime } from '../validators/is-before-end-time.validator';

export class UpdateScheduleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsMilitaryTime()
  @IsBeforeEndTime()
  startTime?: string;

  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @IsOptional()
  @IsString()
  room?: string;
}
