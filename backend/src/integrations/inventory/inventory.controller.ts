import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { InventoryActivityQueryDto } from './dto/inventory-activity-query.dto';
import { ReceiveInventoryDto } from './dto/receive-inventory.dto';
import { InventoryApiKeyGuard } from './inventory-api-key.guard';
import { InventoryAuditService } from './inventory-audit.service';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly audit: InventoryAuditService,
  ) {}

  @Get('activity')
  findActivity(@Query() query: InventoryActivityQueryDto) {
    return this.audit.findActivity(query);
  }

  @Get('activity/:id')
  findActivityById(@Param('id') id: string) {
    return this.audit.findActivityById(id);
  }

  @Public()
  @UseGuards(InventoryApiKeyGuard)
  @Post()
  @HttpCode(HttpStatus.OK)
  receive(@Body() payload: ReceiveInventoryDto) {
    return this.service.receive(payload);
  }
}
