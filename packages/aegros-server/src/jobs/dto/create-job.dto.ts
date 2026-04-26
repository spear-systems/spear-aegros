import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateJobDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'domains must include at least one hostname' })
  @IsString({ each: true })
  domains!: string[];

  @IsOptional()
  @IsIn(['passive', 'standard', 'aggressive'])
  policy?: 'passive' | 'standard' | 'aggressive';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  ackAuthorized?: boolean;
}
