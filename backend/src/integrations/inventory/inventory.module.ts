import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryAuditMiddleware } from './inventory-audit.middleware';
import { InventoryAuditService } from './inventory-audit.service';
import { InventoryController } from './inventory.controller';
import { InventoryApiKeyGuard } from './inventory-api-key.guard';
import { InventoryService } from './inventory.service';
import { NinetyNineFoodClient } from './ninety-nine-food.client';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryApiKeyGuard,
    InventoryAuditMiddleware,
    InventoryAuditService,
    NinetyNineFoodClient,
  ],
})
export class InventoryModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(InventoryAuditMiddleware)
      .forRoutes({ path: 'inventory', method: RequestMethod.POST });
  }
}
