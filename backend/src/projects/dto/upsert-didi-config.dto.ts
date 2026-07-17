import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';

export class UpsertDiDiConfigDto {
  @IsString() appId: string;
  @IsString() appSecret: string;
  @IsOptional() @IsBoolean() testModeEnabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) testShops?: string[];
}
