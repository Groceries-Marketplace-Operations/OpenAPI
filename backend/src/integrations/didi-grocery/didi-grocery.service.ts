import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import SftpClient from 'ssh2-sftp-client';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt, decrypt } from '../../common/crypto.util';
import { refreshAuthToken, getAuthToken } from '../didi-food/didi-food.util';

const DIDI_BASE = 'https://openapi.didi-food.com';
const FILE_PATTERN = /^preciosdidi_(\d{8})_(\d+)\.csv$/i;

interface GroceryConfigInput {
  sftpHost: string;
  sftpPort: number;
  sftpUser: string;
  sftpPassword: string;
  sftpRemoteDir: string;
  maxPerCategory: number;
  scheduleEnabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  scheduleTimezone: string;
}

@Injectable()
export class DiDiGroceryService {
  private readonly logger = new Logger(DiDiGroceryService.name);
  private readonly encKey: string;

  constructor(private prisma: PrismaService, config: ConfigService) {
    this.encKey = config.get('APP_SECRET_ENCRYPTION_KEY') ?? '';
  }

  // ── Config ────────────────────────────────────────────────────────────────

  async upsertConfig(projectId: string, dto: GroceryConfigInput) {
    const sftpPassword = this.encKey ? encrypt(dto.sftpPassword, this.encKey) : dto.sftpPassword;
    return this.prisma.diDiGroceryConfig.upsert({
      where: { projectId },
      create: { projectId, ...dto, sftpPassword },
      update: { ...dto, sftpPassword },
      select: { id: true, sftpHost: true, sftpPort: true, sftpUser: true, sftpRemoteDir: true,
                maxPerCategory: true, scheduleEnabled: true, scheduleHour: true,
                scheduleMinute: true, scheduleTimezone: true, lastRunAt: true, updatedAt: true },
    });
  }

  async getConfig(projectId: string) {
    const cfg = await this.prisma.diDiGroceryConfig.findUnique({ where: { projectId } });
    if (!cfg) return null;
    return { ...cfg, sftpPassword: this.encKey ? decrypt(cfg.sftpPassword, this.encKey) : cfg.sftpPassword };
  }

  async getConfigPublic(projectId: string) {
    return this.prisma.diDiGroceryConfig.findUnique({
      where: { projectId },
      select: { id: true, sftpHost: true, sftpPort: true, sftpUser: true, sftpRemoteDir: true,
                maxPerCategory: true, scheduleEnabled: true, scheduleHour: true,
                scheduleMinute: true, scheduleTimezone: true, lastRunAt: true, updatedAt: true },
    });
  }

  // ── Uploads history ───────────────────────────────────────────────────────

  async listUploads(projectId: string) {
    return this.prisma.diDiGroceryUpload.findMany({
      where: { projectId },
      include: { stores: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Trigger ───────────────────────────────────────────────────────────────

  async triggerUpload(slug: string, mode: 'menu' | 'stock') {
    const project = await this.prisma.project.findUnique({ where: { slug }, include: { diDiConfig: true } });
    if (!project?.active) throw new NotFoundException('Project not found');

    const cfg = await this.getConfig(project.id);
    if (!cfg) throw new NotFoundException('Grocery config not set');

    const diDiCfg = project.diDiConfig;
    if (!diDiCfg) throw new NotFoundException('DiDi config not set');

    // Read SFTP + create upload record first
    const { filename, rows } = await this.readSftp(cfg);

    const upload = await this.prisma.diDiGroceryUpload.create({
      data: { projectId: project.id, filename, mode, status: 'running' },
    });

    // Create pending store records
    const storeIds = [...new Set(rows.map((r: any) => String(r['Store ID']).trim()))];
    await this.prisma.diDiGroceryUploadStore.createMany({
      data: storeIds.map(id => ({ uploadId: upload.id, appShopId: id, status: 'pending' })),
    });

    const appSecret = this.encKey ? decrypt(diDiCfg.appSecret, this.encKey) : diDiCfg.appSecret;

    // Run async
    this.runUploadAsync(upload.id, project.id, diDiCfg.appId, appSecret, cfg, rows, storeIds, mode).catch(() => {});

    return { uploadId: upload.id, filename, stores: storeIds.length };
  }

  private async runUploadAsync(
    uploadId: string,
    projectId: string,
    appId: string,
    appSecret: string,
    cfg: any,
    rows: any[],
    storeIds: string[],
    mode: 'menu' | 'stock',
  ) {
    let anyError = false;

    for (const appShopId of storeIds) {
      try {
        await refreshAuthToken(appId, appSecret, appShopId);
        const token = await getAuthToken(appId, appSecret, appShopId);
        const storeRows = rows.filter((r: any) => String(r['Store ID']).trim() === appShopId);

        let taskId: string | null = null;
        if (mode === 'menu') {
          taskId = await this.uploadMenu(token, appShopId, storeRows, cfg.maxPerCategory);
        } else {
          await this.uploadStock(token, appShopId, storeRows);
        }

        await this.prisma.diDiGroceryUploadStore.updateMany({
          where: { uploadId, appShopId },
          data: { status: 'success', taskId: taskId ?? undefined },
        });
        this.logger.log(`[${uploadId}] ${mode} ok — shop ${appShopId}${taskId ? ` taskId=${taskId}` : ''}`);
      } catch (err: any) {
        anyError = true;
        this.logger.error(`[${uploadId}] ${mode} error — shop ${appShopId}: ${err.message}`);
        await this.prisma.diDiGroceryUploadStore.updateMany({
          where: { uploadId, appShopId },
          data: { status: 'error', errorMessage: err.message },
        });
      }
    }

    await this.prisma.diDiGroceryUpload.update({
      where: { id: uploadId },
      data: { status: anyError ? 'done_with_errors' : 'done' },
    });

    await this.prisma.diDiGroceryConfig.update({
      where: { projectId },
      data: { lastRunAt: new Date() },
    });
  }

  // ── Check task statuses ───────────────────────────────────────────────────

  async checkTasks(uploadId: string) {
    const upload = await this.prisma.diDiGroceryUpload.findUnique({
      where: { id: uploadId },
      include: { stores: true, project: { include: { diDiConfig: true } } },
    });
    if (!upload) throw new NotFoundException('Upload not found');

    const diDiCfg = upload.project.diDiConfig;
    if (!diDiCfg) throw new NotFoundException('DiDi config not set');
    const appSecret = this.encKey ? decrypt(diDiCfg.appSecret, this.encKey) : diDiCfg.appSecret;

    const results: any[] = [];
    for (const store of upload.stores.filter(s => s.taskId)) {
      try {
        await refreshAuthToken(diDiCfg.appId, appSecret, store.appShopId);
        const token = await getAuthToken(diDiCfg.appId, appSecret, store.appShopId);

        const res = await fetch(`${DIDI_BASE}/v3/item/item/getGroceryMenuTaskInfo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth_token: token, task_id: store.taskId }),
        });
        const data: any = await res.json();
        results.push({ appShopId: store.appShopId, taskId: store.taskId, data: data.data });
      } catch (err: any) {
        results.push({ appShopId: store.appShopId, taskId: store.taskId, error: err.message });
      }
    }
    return results;
  }

  // ── SFTP ──────────────────────────────────────────────────────────────────

  private async readSftp(cfg: any): Promise<{ filename: string; rows: any[] }> {
    const sftp = new SftpClient();
    await sftp.connect({
      host: cfg.sftpHost,
      port: cfg.sftpPort,
      username: cfg.sftpUser,
      password: cfg.sftpPassword,
    });

    try {
      const files: any[] = await sftp.list(cfg.sftpRemoteDir);
      const matches = files
        .filter((f: any) => FILE_PATTERN.test(f.name))
        .map((f: any) => {
          const m = FILE_PATTERN.exec(f.name)!;
          return { date: m[1], seq: parseInt(m[2]), name: f.name };
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq);

      if (!matches.length) throw new Error('No preciosdidi_* file found in SFTP');

      const filename = matches[0].name;
      const buffer = await sftp.get(`${cfg.sftpRemoteDir}/${filename}`) as Buffer;
      const rows = parse(buffer, { delimiter: '|', columns: true, skip_empty_lines: true, cast: true });
      this.logger.log(`SFTP: read ${rows.length} rows from ${filename}`);
      return { filename, rows };
    } finally {
      await sftp.end();
    }
  }

  // ── DiDi API ──────────────────────────────────────────────────────────────

  private async uploadMenu(token: string, appShopId: string, rows: any[], maxPerCategory: number): Promise<string> {
    const items = rows.map((r: any) => {
      const upc = String(r['Ean']).trim();
      return {
        item_name: 'Producto',
        upc,
        app_item_id: upc,
        price: Math.round(parseFloat(r['Price Without Discount']) * 100),
        activity_price: Math.round(parseFloat(r['Price With Discount']) * 100),
        status: parseInt(r['Stock']) > 0 ? 1 : 2,
        sold_info_intl: [],
        item_tags: [],
      };
    });

    const categories = [];
    for (let i = 0; i < items.length; i += maxPerCategory) {
      const chunk = items.slice(i, i + maxPerCategory);
      const catId = `cat_${appShopId}_${categories.length + 1}`;
      categories.push({ app_category_id: catId, category_name: 'Despensa', app_item_ids: chunk.map(it => it.app_item_id) });
    }

    const payload = {
      auth_token: token,
      menus: [{ menu_name: `Despensa ${appShopId}`, app_menu_id: `menu_${appShopId}`, app_category_ids: categories.map(c => c.app_category_id) }],
      categories,
      items,
      merge_policy: 1,
    };

    const res = await fetch(`${DIDI_BASE}/v3/item/item/uploadGrocery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data: any = await res.json();
    if (data.errno !== 0 && data.errno !== '0') throw new Error(`DiDi upload error ${data.errno}: ${data.errmsg}`);
    return String(data.data.taskID);
  }

  private async uploadStock(token: string, appShopId: string, rows: any[]): Promise<void> {
    const stockList = rows.map((r: any) => ({
      app_item_id: String(r['Ean']).trim(),
      stock: parseInt(r['Stock']),
    }));

    const CHUNK = 2000;
    for (let i = 0; i < stockList.length; i += CHUNK) {
      const chunk = stockList.slice(i, i + CHUNK);
      const res = await fetch(`${DIDI_BASE}/v1/item/item/setStockSync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: token, stock_list: chunk }),
      });
      const data: any = await res.json();
      if (data.errno !== 0 && data.errno !== '0') throw new Error(`DiDi stock error ${data.errno}: ${data.errmsg}`);
    }
  }

  // ── Scheduler helper ──────────────────────────────────────────────────────

  async getActiveSchedules() {
    return this.prisma.diDiGroceryConfig.findMany({
      where: { scheduleEnabled: true },
      include: { project: { select: { slug: true, active: true } } },
    });
  }
}
