import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InventoryAuditService } from './inventory-audit.service';
import {
  InventoryLoadType,
  InventoryRecordDto,
  ReceiveInventoryDto,
} from './dto/receive-inventory.dto';
import {
  NinetyNineFoodClient,
  NinetyNineGroceryCategory,
  NinetyNineGroceryItem,
} from './ninety-nine-food.client';

const MAX_ITEMS_PER_CATEGORY = 3_000;
const VALID_EAN = /^[A-Za-z0-9]{1,14}$/;

type InventoryRecordWithEan = InventoryRecordDto & { ean: string };

export interface InventoryReceipt {
  job_id: string;
  status: 'created';
  created_at: string;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly ninetyNineFood: NinetyNineFoodClient,
    private readonly audit: InventoryAuditService,
  ) {}

  async receive(payload: ReceiveInventoryDto): Promise<InventoryReceipt> {
    const jobId = this.audit.getRequestId() ?? randomUUID();
    const createdAt = new Date().toISOString();
    const validRecords = payload.records.filter(
      (record): record is InventoryRecordWithEan =>
        typeof record.ean === 'string' && VALID_EAN.test(record.ean),
    );
    const skippedCount = payload.records.length - validRecords.length;
    if (skippedCount > 0) {
      this.logger.warn(`Inventory job ${jobId}: skipped ${skippedCount} records with invalid ean`);
    }
    if (validRecords.length === 0) {
      throw new BadRequestException('No records with a valid ean to process');
    }

    const recordsByStore = this.groupByStore(validRecords);

    for (const [storeId, records] of recordsByStore) {
      this.validateStoreRecords(storeId, records);

      const authToken = await this.ninetyNineFood.getAuthToken(storeId);
      const items = records.map(record => this.toNinetyNineItem(record));
      const categories = this.buildCategories(items);
      const taskId = await this.ninetyNineFood.uploadGrocery(authToken, storeId, {
        menus: [{
          app_menu_id: `menu_${storeId}`,
          menu_name: 'Main catalogue',
          app_category_ids: categories.map(category => category.app_category_id),
        }],
        categories,
        items,
        merge_policy: payload.type === InventoryLoadType.FULL ? 1 : 0,
      });

      this.logger.log(`Inventory job ${jobId}: store ${storeId} accepted as 99Food task ${taskId}`);
    }

    return {
      job_id: jobId,
      status: 'created',
      created_at: createdAt,
    };
  }

  private groupByStore(records: InventoryRecordWithEan[]): Map<string, InventoryRecordWithEan[]> {
    const grouped = new Map<string, InventoryRecordWithEan[]>();

    for (const record of records) {
      const storeRecords = grouped.get(record.store_id) ?? [];
      storeRecords.push(record);
      grouped.set(record.store_id, storeRecords);
    }

    return grouped;
  }

  private validateStoreRecords(storeId: string, records: InventoryRecordWithEan[]): void {
    if (records.length > 30_000) {
      throw new BadRequestException(`Store ${storeId} exceeds the 99Food limit of 30000 items`);
    }

    const itemIds = new Set<string>();
    for (const record of records) {
      if (itemIds.has(record.id)) {
        throw new BadRequestException(`Duplicate item id ${record.id} for store ${storeId}`);
      }
      itemIds.add(record.id);

      if (record.discount_price > record.price) {
        throw new BadRequestException(
          `discount_price cannot exceed price for item ${record.id} in store ${storeId}`,
        );
      }

      if (
        record.discount_price > 0
        && record.discount_price < record.price
        && (record.price - record.discount_price) / record.price < 0.01
      ) {
        throw new BadRequestException(
          `The discount for item ${record.id} in store ${storeId} must be at least 1%`,
        );
      }
    }
  }

  private toNinetyNineItem(record: InventoryRecordWithEan): NinetyNineGroceryItem {
    const item: NinetyNineGroceryItem = {
      app_item_id: record.id,
      upc: record.ean,
      app_external_id: {
        store_id: record.store_id,
        trademark: record.trademark,
        sale_type: record.sale_type,
      },
      item_name: record.name,
      short_desc: record.description,
      price: this.toMinorUnits(record.price, record.id),
      stock: record.stock,
      status: record.is_available ? 1 : 2,
      sold_info_intl: [],
      item_tags: [],
    };

    if (record.discount_price > 0 && record.discount_price < record.price) {
      item.activity_price = this.toMinorUnits(record.discount_price, record.id);
    }

    return item;
  }

  private buildCategories(items: NinetyNineGroceryItem[]): NinetyNineGroceryCategory[] {
    const categories: NinetyNineGroceryCategory[] = [];

    for (let offset = 0; offset < items.length; offset += MAX_ITEMS_PER_CATEGORY) {
      categories.push({
        app_category_id: String(categories.length + 1),
        category_name: 'Despensa',
        app_item_ids: items
          .slice(offset, offset + MAX_ITEMS_PER_CATEGORY)
          .map(item => item.app_item_id),
      });
    }

    return categories;
  }

  private toMinorUnits(value: number, itemId: string): number {
    const minorUnits = Math.round(value * 100);
    if (!Number.isSafeInteger(minorUnits)) {
      throw new BadRequestException(`Price is outside the supported range for item ${itemId}`);
    }
    return minorUnits;
  }
}
