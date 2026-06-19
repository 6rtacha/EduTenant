import {
  IsInt,
  IsMilitaryTime,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IsBeforeEndTime } from '../validators/is-before-end-time.validator';

export class CreateScheduleDto {
  @IsString()
  classId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsMilitaryTime()
  @IsBeforeEndTime()
  startTime!: string;

  @IsMilitaryTime()
  endTime!: string;

  @IsOptional()
  @IsString()
  room?: string;
}
