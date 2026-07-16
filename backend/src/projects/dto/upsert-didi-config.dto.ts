import { IsString } from 'class-validator';

export class UpsertDiDiConfigDto {
  @IsString() appId: string;
  @IsString() appSecret: string;
}
