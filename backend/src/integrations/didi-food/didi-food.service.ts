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

  async handleWebhook(slug: string, rawBody: string, signature: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project?.active) throw new NotFoundException('Project not found');

    const cfg = await this.projects.getDiDiConfig(project.id);
    if (!cfg) throw new NotFoundException('DiDi config not set');

    if (!verifyWebhookSignature(rawBody, signature, cfg.appSecret)) {
      throw new UnauthorizedException('Invalid signature');
    }

    let payload: any;
    try { payload = JSON.parse(rawBody); } catch { throw new BadRequestException('Invalid JSON'); }

    const body = payload.PARAM
      ? (typeof payload.PARAM === 'string' ? JSON.parse(payload.PARAM) : payload.PARAM)
      : payload;

    // Validate app_id without precision loss
    const appIdMatch = rawBody.match(/"app_id"\s*:\s*(\d+)/);
    const incomingAppId = appIdMatch ? appIdMatch[1] : String(body.app_id);
    if (incomingAppId !== String(cfg.appId)) throw new UnauthorizedException('app_id mismatch');

    if (body.type !== 'orderNew') return { ignored: true };

    const { app_shop_id, timestamp } = body;
    const orderInfo = body?.data?.order_info;
    if (!orderInfo || !app_shop_id || !timestamp) throw new BadRequestException('Missing fields');

    // Extract order_id without precision loss
    const sourceStr = payload.PARAM
      ? (typeof payload.PARAM === 'string' ? payload.PARAM : JSON.stringify(payload.PARAM))
      : rawBody;
    const orderIdMatch = sourceStr.match(/"order_info"\s*:\s*\{[^}]*?"order_id"\s*:\s*(\d+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : String(orderInfo.order_id);
    const orderIndex = orderInfo.order_index as number;

    const date = new Date(Number(timestamp) * 1000)
      .toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    // Upsert (idempotent)
    await this.prisma.diDiOrderEvent.upsert({
      where: { projectId_appShopId_date_orderIndex: { projectId: project.id, appShopId: String(app_shop_id), date, orderIndex } },
      create: { projectId: project.id, appShopId: String(app_shop_id), orderId, orderIndex, date, timestamp: BigInt(timestamp) },
      update: {},
    });

    this.logger.log(`Stored order ${orderId} index ${orderIndex} shop ${app_shop_id}`);

    // Confirm order (async, don't block response)
    this.confirmOrderAsync(project.id, cfg.appId, cfg.appSecret, String(app_shop_id), orderId).catch(() => {});

    return { success: true };
  }

  private async confirmOrderAsync(projectId: string, appId: string, appSecret: string, appShopId: string, orderId: string) {
    try {
      await refreshAuthToken(appId, appSecret, appShopId);
      const token = await getAuthToken(appId, appSecret, appShopId);
      await confirmOrder(token, orderId);
      await this.prisma.diDiOrderEvent.updateMany({
        where: { projectId, orderId },
        data: { confirmed: true, confirmError: null },
      });
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Confirm failed for order ${orderId}: ${msg}`);
      await this.prisma.diDiOrderEvent.updateMany({
        where: { projectId, orderId },
        data: { confirmed: false, confirmError: msg },
      });
    }
  }

  async createTestOrder(slug: string, appShopId: string, orderIndex: number, date?: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project?.active) throw new NotFoundException('Project not found');

    const cfg = await this.projects.getDiDiConfig(project.id);
    if (!cfg) throw new NotFoundException('DiDi config not set');
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
        data: { projectId: project.id, appShopId, orderId, orderIndex, date: targetDate, timestamp: BigInt(timestamp), confirmed: true },
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
    if (appId !== cfg.appId) throw new UnauthorizedException('Invalid app_id');

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) throw new UnauthorizedException('Timestamp expired');

    if (!verifyQuerySignature(appId, timestamp, signature, cfg.appSecret)) {
      throw new UnauthorizedException('Invalid signature');
    }

    const targetDate = date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const event = await this.prisma.diDiOrderEvent.findUnique({
      where: { projectId_appShopId_date_orderIndex: { projectId: project.id, appShopId, date: targetDate, orderIndex } },
    });

    if (!event) throw new NotFoundException(`Order not found for shop ${appShopId} index ${orderIndex} on ${targetDate}`);

    return {
      order_id: event.orderId,
      order_index: event.orderIndex,
      app_shop_id: event.appShopId,
      date: targetDate,
    };
  }
}
