import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryActivityQueryDto } from './dto/inventory-activity-query.dto';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'api_key',
  'app_secret',
  'auth_token',
  'authorization',
  'cookie',
  'set-cookie',
  'x-signature',
]);

export interface InventoryUpstreamAudit {
  sequence: number;
  operation: string;
  storeId?: string;
  taskId?: string;
  method: string;
  url: string;
  requestHeaders?: unknown;
  requestBody?: unknown;
  responseStatus?: number;
  responseHeaders?: unknown;
  responseBody?: unknown;
  responseRawBody?: string;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
  durationMs: number;
}

export interface InventoryAuditContext {
  id: string;
  startedAt: Date;
  loadType?: string;
  method: string;
  path: string;
  sourceIp?: string;
  userAgent?: string;
  requestHeaders: unknown;
  requestBody?: unknown;
  requestRawBody?: string;
  recordCount?: number;
  storeIds: string[];
  upstreamCalls: InventoryUpstreamAudit[];
}

@Injectable()
export class InventoryAuditService {
  private readonly logger = new Logger(InventoryAuditService.name);
  private readonly storage = new AsyncLocalStorage<InventoryAuditContext>();

  constructor(private readonly prisma: PrismaService) {}

  createContext(request: Request): InventoryAuditContext {
    const body = request.body && typeof request.body === 'object'
      ? request.body as Record<string, unknown>
      : undefined;
    const records = Array.isArray(body?.records) ? body.records : undefined;
    const storeIds = records
      ? [...new Set(records
        .map(record => this.asRecord(record)?.store_id)
        .filter((value): value is string => typeof value === 'string'))]
      : [];
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody?.toString('utf8');

    return {
      id: randomUUID(),
      startedAt: new Date(),
      loadType: typeof body?.type === 'string' ? body.type : undefined,
      method: request.method,
      path: this.redactUrl(request.originalUrl || request.url),
      sourceIp: request.ip,
      userAgent: request.get('user-agent'),
      requestHeaders: this.redact(request.headers),
      requestBody: body === undefined ? undefined : this.redact(body),
      requestRawBody: rawBody ? this.redactRaw(rawBody) : undefined,
      recordCount: records?.length,
      storeIds,
      upstreamCalls: [],
    };
  }

  run<T>(context: InventoryAuditContext, next: () => T): T {
    return this.storage.run(context, next);
  }

  getRequestId(): string | undefined {
    return this.storage.getStore()?.id;
  }

  async findActivity(query: InventoryActivityQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.InventoryRequestLogWhereInput = {};

    if (query.type) where.loadType = query.type;
    if (query.success !== undefined) where.success = query.success === 'true';
    if (query.storeId?.trim()) where.storeIds = { has: query.storeId.trim() };
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { path: { contains: search, mode: 'insensitive' } },
        { sourceIp: { contains: search, mode: 'insensitive' } },
        { storeIds: { has: search } },
        {
          upstreamCalls: {
            some: {
              OR: [
                { storeId: { contains: search, mode: 'insensitive' } },
                { taskId: { contains: search, mode: 'insensitive' } },
                { operation: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.inventoryRequestLog.count({ where }),
      this.prisma.inventoryRequestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          loadType: true,
          method: true,
          path: true,
          sourceIp: true,
          userAgent: true,
          responseStatus: true,
          success: true,
          errorMessage: true,
          recordCount: true,
          storeIds: true,
          durationMs: true,
          createdAt: true,
          completedAt: true,
          upstreamCalls: {
            orderBy: { sequence: 'asc' },
            select: {
              sequence: true,
              operation: true,
              storeId: true,
              taskId: true,
              responseStatus: true,
              success: true,
              durationMs: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findActivityById(id: string) {
    const activity = await this.prisma.inventoryRequestLog.findUnique({
      where: { id },
      include: { upstreamCalls: { orderBy: { sequence: 'asc' } } },
    });

    if (!activity) {
      throw new NotFoundException(`Inventory activity ${id} was not found`);
    }
    return activity;
  }

  recordUpstream(entry: Omit<InventoryUpstreamAudit, 'sequence'>): void {
    const context = this.storage.getStore();
    if (!context) {
      this.logger.warn(`Upstream audit skipped outside inventory request: ${entry.operation}`);
      return;
    }

    context.upstreamCalls.push({
      ...entry,
      sequence: context.upstreamCalls.length + 1,
      url: this.redactUrl(entry.url),
      requestHeaders: this.redact(entry.requestHeaders),
      requestBody: this.redact(entry.requestBody),
      responseHeaders: this.redact(entry.responseHeaders),
      responseBody: this.redact(entry.responseBody),
      responseRawBody: entry.responseRawBody
        ? this.redactRaw(entry.responseRawBody)
        : undefined,
    });
  }

  async persist(
    context: InventoryAuditContext,
    response: Response,
    responsePayload: unknown,
  ): Promise<void> {
    const completedAt = new Date();
    const responseBody = this.parsePayload(responsePayload);
    const errorMessage = this.extractErrorMessage(responseBody);

    try {
      await this.prisma.inventoryRequestLog.create({
        data: {
          id: context.id,
          loadType: context.loadType,
          method: context.method,
          path: context.path,
          sourceIp: context.sourceIp,
          userAgent: context.userAgent,
          requestHeaders: this.toJson(context.requestHeaders),
          requestBody: this.toJson(context.requestBody),
          requestRawBody: context.requestRawBody,
          responseStatus: response.statusCode,
          responseHeaders: this.toJson(this.redact(response.getHeaders())),
          responseBody: this.toJson(responseBody),
          responseRawBody: this.toRawString(responsePayload),
          success: response.statusCode < 400,
          errorMessage: response.statusCode >= 400 ? errorMessage : undefined,
          recordCount: context.recordCount,
          storeIds: context.storeIds,
          durationMs: completedAt.getTime() - context.startedAt.getTime(),
          createdAt: context.startedAt,
          completedAt,
          upstreamCalls: {
            create: context.upstreamCalls.map(call => ({
              sequence: call.sequence,
              operation: call.operation,
              storeId: call.storeId,
              taskId: call.taskId,
              method: call.method,
              url: call.url,
              requestHeaders: this.toJson(call.requestHeaders),
              requestBody: this.toJson(call.requestBody),
              responseStatus: call.responseStatus,
              responseHeaders: this.toJson(call.responseHeaders),
              responseBody: this.toJson(call.responseBody),
              responseRawBody: call.responseRawBody,
              success: call.success,
              errorMessage: call.errorMessage,
              createdAt: call.createdAt,
              durationMs: call.durationMs,
            })),
          },
        } as any,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Could not persist inventory audit ${context.id}: ${message}`);
    }
  }

  redact(value: unknown): unknown {
    if (value === undefined || value === null) return value;
    if (Array.isArray(value)) return value.map(item => this.redact(item));
    if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
    if (typeof value !== 'object') return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : this.redact(item),
      ]),
    );
  }

  redactRaw(raw: string): string {
    return raw.replace(
      /("(?:api_key|app_secret|auth_token|authorization|cookie|set-cookie|x-signature)"\s*:\s*")[^"]*(")/gi,
      `$1${REDACTED}$2`,
    );
  }

  private redactUrl(value: string): string {
    try {
      const url = new URL(value);
      for (const key of SENSITIVE_KEYS) {
        if (url.searchParams.has(key)) url.searchParams.set(key, REDACTED);
      }
      return url.toString();
    } catch {
      return value.replace(
        /([?&](?:api_key|app_secret|auth_token|authorization)=)[^&]*/gi,
        `$1${encodeURIComponent(REDACTED)}`,
      );
    }
  }

  private parsePayload(payload: unknown): unknown {
    if (Buffer.isBuffer(payload)) return this.parsePayload(payload.toString('utf8'));
    if (typeof payload !== 'string') return this.redact(payload);

    try {
      return this.redact(JSON.parse(payload));
    } catch {
      return { raw: this.redactRaw(payload) };
    }
  }

  private toRawString(payload: unknown): string | undefined {
    if (payload === undefined) return undefined;
    if (Buffer.isBuffer(payload)) return this.redactRaw(payload.toString('utf8'));
    if (typeof payload === 'string') return this.redactRaw(payload);
    return this.redactRaw(JSON.stringify(payload));
  }

  private toJson(value: unknown): unknown {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  private extractErrorMessage(payload: unknown): string | undefined {
    const record = this.asRecord(payload);
    if (!record?.message) return undefined;
    return typeof record.message === 'string'
      ? record.message
      : JSON.stringify(record.message);
  }

  private asRecord(value: unknown): Record<string, any> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, any>
      : undefined;
  }
}
