import { randomInt } from 'crypto';
import { Injectable, Logger, UnauthorizedException, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from '../../projects/projects.service';
import {
  verifyWebhookSignature, verifyQuerySignature,
  refreshAuthToken, getAuthToken, confirmOrder,
} from './didi-food.util';

@Injectable()
export class DiDiFoodService {
  private readonly logger = new Logger(DiDiFoodService.name);

  constructor(private prisma: PrismaService, private projects: ProjectsService) {}

  private selectCredentials(cfg: NonNullable<Awaited<ReturnType<ProjectsService['getDiDiConfig']>>>, appId: string) {
    if (appId === cfg.appId) return { appId, appSecret: cfg.appSecret, environment: 'production' };
    if (appId === cfg.testAppId && cfg.testAppSecret) {
      return { appId, appSecret: cfg.testAppSecret, environment: 'test' };
    }
    throw new UnauthorizedException('Invalid app_id');
  }

  private validateTestAccess(cfg: { testModeEnabled: boolean; testShops: string[] }, environment: string, shop: string) {
    if (environment === 'test' && (!cfg.testModeEnabled || !cfg.testShops.includes(shop))) {
      throw new ForbiddenException('Test mode must be enabled and the shop must be allowed');
    }
  }

  async handleWebhook(slug: string, rawBody: string, signature: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project?.active) throw new NotFoundException('Project not found');

    const cfg = await this.projects.getDiDiConfig(project.id);
    if (!cfg) throw new NotFoundException('DiDi config not set');

    let payload: any;
    let body: any;
    try {
      payload = JSON.parse(rawBody);
      body = payload.PARAM
        ? (typeof payload.PARAM === 'string' ? JSON.parse(payload.PARAM) : payload.PARAM)
        : payload;
      if (!body || typeof body !== 'object') throw new Error();
    } catch { throw new BadRequestException('Invalid JSON'); }
    const source = typeof payload.PARAM === 'string' ? payload.PARAM : rawBody;
    const appIdMatch = source.match(/"app_id"\s*:\s*(\d+)/);
    const incomingAppId = appIdMatch ? appIdMatch[1] : String(body.app_id);
    const credentials = this.selectCredentials(cfg, incomingAppId);
    if (!verifyWebhookSignature(rawBody, signature, credentials.appSecret)) {
      throw new UnauthorizedException('Invalid signature');
    }
    this.validateTestAccess(cfg, credentials.environment, String(body.app_shop_id));

    if (body.type !== 'orderNew') return { ignored: true };

    const { app_shop_id, timestamp } = body;
    const orderInfo = body?.data?.order_info;
    if (!orderInfo || !app_shop_id || !timestamp) throw new BadRequestException('Missing fields');

    // Extract order_id without precision loss (search after "order_info" key)
    const sourceStr = payload.PARAM
      ? (typeof payload.PARAM === 'string' ? payload.PARAM : JSON.stringify(payload.PARAM))
      : rawBody;
    const orderInfoPos = sourceStr.indexOf('"order_info"');
    const orderIdMatch = orderInfoPos !== -1
      ? sourceStr.slice(orderInfoPos).match(/"order_id"\s*:\s*(\d+)/)
      : null;
    const orderId = orderIdMatch ? orderIdMatch[1] : String(orderInfo.order_id);
    const orderIndex = orderInfo.order_index as number;

    const date = new Date(Number(timestamp) * 1000)
      .toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    // Upsert (idempotent)
    await this.prisma.diDiOrderEvent.upsert({
      where: { projectId_environment_appShopId_date_orderIndex: { projectId: project.id, environment: credentials.environment, appShopId: String(app_shop_id), date, orderIndex } },
      create: { projectId: project.id, environment: credentials.environment, appShopId: String(app_shop_id), orderId, orderIndex, date, timestamp: BigInt(timestamp) },
      update: {},
    });

    this.logger.log(`Stored order ${orderId} index ${orderIndex} shop ${app_shop_id}`);

    // Confirm order (async, don't block response)
    this.confirmOrderAsync(project.id, credentials.environment, credentials.appId, credentials.appSecret, String(app_shop_id), orderId).catch(() => {});

    return { success: true };
  }

  private async confirmOrderAsync(projectId: string, environment: string, appId: string, appSecret: string, appShopId: string, orderId: string) {
    try {
      await refreshAuthToken(appId, appSecret, appShopId);
      const token = await getAuthToken(appId, appSecret, appShopId);
      await confirmOrder(token, orderId);
      await this.prisma.diDiOrderEvent.updateMany({
        where: { projectId, environment, appShopId, orderId },
        data: { confirmed: true, confirmError: null },
      });
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Confirm failed for order ${orderId}: ${msg}`);
      await this.prisma.diDiOrderEvent.updateMany({
        where: { projectId, environment, appShopId, orderId },
        data: { confirmed: false, confirmError: msg },
      });
    }
  }

  async createTestOrder(slug: string, appShopId: string, orderIndex: number, date?: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project?.active) throw new NotFoundException('Project not found');

    const cfg = await this.projects.getDiDiConfig(project.id);
    if (!cfg) throw new NotFoundException('DiDi config not set');
    if (!cfg.testAppId || !cfg.testAppSecret) throw new ForbiddenException('Test credentials are not configured');
    if (!cfg.testModeEnabled) throw new ForbiddenException('Test mode is disabled for this project');
    if (!cfg.testShops.includes(appShopId)) {
      throw new ForbiddenException(`Shop ${appShopId} is not in the allowed test shops list`);
    }

    const PREFIX = '576467';
    const TOTAL_LENGTH = 19;
    let suffix = '';
    while (suffix.length < TOTAL_LENGTH - PREFIX.length) suffix += randomInt(0, 10).toString();
    const orderId = PREFIX + suffix;

    const timestamp = Math.floor(Date.now() / 1000);
    const targetDate = date ?? new Date(timestamp * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    try {
      await this.prisma.diDiOrderEvent.create({
        data: { projectId: project.id, environment: 'test', appShopId, orderId, orderIndex, date: targetDate, timestamp: BigInt(timestamp), confirmed: true },
      });
    } catch (err: any) {
      if (err.code === 'P2002') throw new ConflictException('An order with this shop/date/order_index already exists');
      throw err;
    }

    this.logger.log(`Test order created: ${orderId} index ${orderIndex} shop ${appShopId}`);
    return { success: true, orderId, orderIndex, appShopId, date: targetDate, timestamp };
  }

  async queryOrder(slug: string, headers: Record<string, string>, appShopId: string, orderIndex: number, date?: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project?.active) throw new NotFoundException('Project not found');

    const cfg = await this.projects.getDiDiConfig(project.id);
    if (!cfg) throw new NotFoundException('DiDi config not set');

    const { 'x-app-id': appId, 'x-timestamp': timestamp, 'x-signature': signature } = headers;
    if (!appId || !timestamp || !signature) throw new UnauthorizedException('Missing auth headers');
    const credentials = this.selectCredentials(cfg, appId);
    this.validateTestAccess(cfg, credentials.environment, appShopId);

    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(Number(timestamp)) || Math.abs(now - Number(timestamp)) > 300) throw new UnauthorizedException('Timestamp expired');

    if (!verifyQuerySignature(appId, timestamp, signature, credentials.appSecret)) {
      throw new UnauthorizedException('Invalid signature');
    }

    const targetDate = date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const event = await this.prisma.diDiOrderEvent.findUnique({
      where: { projectId_environment_appShopId_date_orderIndex: { projectId: project.id, environment: credentials.environment, appShopId, date: targetDate, orderIndex } },
    });

    if (!event) throw new NotFoundException(`Order not found for shop ${appShopId} index ${orderIndex} on ${targetDate}`);

    return {
      success: true,
      data: {
        order_id: event.orderId,
        order_index: String(event.orderIndex),
        app_shop_id: event.appShopId,
        date: targetDate,
      },
    };
  }
}
