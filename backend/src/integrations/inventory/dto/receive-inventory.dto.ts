import { Type } from 'class-transformer';
import {
  Allow,
  ArrayNotEmpty,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum InventoryLoadType {
  DELTA = 'DELTA',
  FULL = 'FULL',
}

export class InventoryRecordDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  store_id: string;

  // Keep invalid values so the service can skip those records individually.
  @Allow()
  ean: unknown;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @MaxLength(400)
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount_price: number;

  @IsInt()
  @Min(0)
  stock: number;

  @IsString()
  @Equals('N')
  sale_type: string;

  @IsBoolean()
  is_available: boolean;

  @IsString()
  trademark: string;
}

export class ReceiveInventoryDto {
  @IsEnum(InventoryLoadType)
  type: InventoryLoadType;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => InventoryRecordDto)
  records: InventoryRecordDto[];
}
