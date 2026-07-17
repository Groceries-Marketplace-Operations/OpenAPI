import { Body, Controller, Get, Headers, Param, Post, Query, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { DiDiFoodService } from './didi-food.service';

class CreateTestOrderDto {
  @IsString() appShopId: string;
  @IsNumber() orderIndex: number;
  @IsOptional() @IsString() date?: string;
}

@Controller()
export class DiDiFoodController {
  constructor(private service: DiDiFoodService) {}

  @Public()
  @Post('didi/:slug/webhook')
  async webhook(
    @Param('slug') slug: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('didi-header-sign') signature: string,
  ) {
    if (!signature) throw new UnauthorizedException('Missing signature');
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    return this.service.handleWebhook(slug, rawBody, signature);
  }

  @Post('didi/:slug/test-orders')
  @Roles('admin')
  createTestOrder(@Param('slug') slug: string, @Body() dto: CreateTestOrderDto) {
    return this.service.createTestOrder(slug, dto.appShopId, dto.orderIndex, dto.date);
  }

  @Public()
  @Get('didi/:slug/orders')
  async queryOrder(
    @Param('slug') slug: string,
    @Headers() headers: Record<string, string>,
    @Query('app_shop_id') appShopId: string,
    @Query('order_index') orderIndex: string,
    @Query('date') date?: string,
  ) {
    return this.service.queryOrder(slug, headers, appShopId, Number(orderIndex), date);
  }
}
