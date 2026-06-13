import {
  IsInt,
  IsMilitaryTime,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ClassScheduleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsMilitaryTime()
  startTime: string;

  @IsMilitaryTime()
  endTime: string;

  @IsOptional()
  @IsString()
  room?: string;
}
