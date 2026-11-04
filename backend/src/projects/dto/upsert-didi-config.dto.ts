import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';

export class UpsertDiDiConfigDto {
  @IsString() appId: string;
  @IsOptional() @IsString() appSecret?: string;
  @IsOptional() @IsString() testAppId?: string;
  @IsOptional() @IsString() testAppSecret?: string;
  @IsOptional() @IsBoolean() testModeEnabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) testShops?: string[];
}
