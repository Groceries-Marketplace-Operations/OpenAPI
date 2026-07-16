import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpsertProjectDto {
  @IsString() name: string;
  @IsString() @Matches(/^[a-z0-9-]+$/) slug: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
