import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InventoryAuditService } from './inventory-audit.service';

export interface NinetyNineGroceryItem {
  app_item_id: string;
  upc: string;
  app_external_id: Record<string, string>;
  item_name: string;
  short_desc: string;
  price: number;
  activity_price?: number;
  stock: number;
  status: 1 | 2;
  sold_info_intl: unknown[];
  item_tags: number[];
}

export interface NinetyNineGroceryPayload {
  menus: Array<{
    app_menu_id: string;
    menu_name: string;
    app_category_ids: string[];
  }>;
  categories: unknown[];
  items: NinetyNineGroceryItem[];
  merge_policy: 0 | 1;
}

interface NinetyNineResponse {
  errno: number | string;
  errmsg?: string;
  data?: Record<string, unknown>;
}
interface UpstreamAuditDetails {
  operation: string;
  storeId: string;
  requestBody?: unknown;
}

@Injectable()
export class NinetyNineFoodClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly audit: InventoryAuditService,
  ) {
    this.baseUrl = (config.get<string>('INVENTORY_BASE_URL') || 'https://openapi.99food.com')
      .replace(/\/$/, '');
    this.timeoutMs = Number(config.get<string>('INVENTORY_99_TIMEOUT_MS') ?? 30_000);
  }

  async getAuthToken(appShopId: string): Promise<string> {
    let response = await this.callAuthEndpoint('get', appShopId);
    const errno = this.errorNumber(response.body.errno);

    if (errno === 10101 || errno === 10102) {
      const refreshed = await this.callAuthEndpoint('refresh', appShopId);
      this.assertSuccess(refreshed.body, 'refresh auth token');
      response = await this.callAuthEndpoint('get', appShopId);
    }

    this.assertSuccess(response.body, 'get auth token');
    const authToken = response.body.data?.auth_token;
    if (typeof authToken !== 'string' || !authToken) {
      throw new BadGatewayException('99Food returned an empty auth_token');
    }

    return authToken;
  }

  async uploadGrocery(
    authToken: string,
    appShopId: string,
    payload: NinetyNineGroceryPayload,
  ): Promise<string> {
    const response = await this.request(
      `${this.baseUrl}/v3/item/item/uploadGrocery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_token: authToken, ...payload }),
      },
      'upload grocery menu',
      {
        operation: 'upload_grocery',
        storeId: appShopId,
        requestBody: { auth_token: authToken, ...payload },
      },
    );

    this.assertSuccess(response.body, 'upload grocery menu');
    const taskIdMatch = response.raw.match(/"taskID"\s*:\s*"?([0-9]+)"?/);
    if (!taskIdMatch) {
      throw new BadGatewayException('99Food accepted the request without returning taskID');
    }

    return taskIdMatch[1];
  }

  private async callAuthEndpoint(
    operation: 'get' | 'refresh',
    appShopId: string,
  ): Promise<{ body: NinetyNineResponse; raw: string }> {
    const appId = this.requiredConfig('INVENTORY_APP_ID');
    const appSecret = this.requiredConfig('INVENTORY_APP_SECRET');
    const query = new URLSearchParams({
      app_id: appId,
      app_secret: appSecret,
      app_shop_id: appShopId,
    });

    return this.request(
      `${this.baseUrl}/v1/auth/authtoken/${operation}?${query.toString()}`,
      { method: 'GET' },
      `${operation} auth token`,
      {
        operation: `${operation}_auth_token`,
        storeId: appShopId,
        requestBody: { app_id: appId, app_secret: appSecret, app_shop_id: appShopId },
      },
    );
  }

  private requiredConfig(name: string): string {
    const value = this.config.get<string>(name);
    if (!value) {
      throw new ServiceUnavailableException(`${name} is not configured`);
    }
    return value;
  }

  private async request(
    url: string,
    init: RequestInit,
    operation: string,
    auditDetails: UpstreamAuditDetails,
  ): Promise<{ body: NinetyNineResponse; raw: string }> {
    const startedAt = new Date();
    const method = init.method ?? 'GET';
    const requestHeaders = Object.fromEntries(new Headers(init.headers).entries());
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.audit.recordUpstream({
        ...auditDetails,
        method,
        url,
        requestHeaders,
        success: false,
        errorMessage,
        createdAt: startedAt,
        durationMs: Date.now() - startedAt.getTime(),
      });
      throw new BadGatewayException(`Could not connect to 99Food to ${operation}`);
    }

    let raw: string;
    try {
      raw = await response.text();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.audit.recordUpstream({
        ...auditDetails,
        method,
        url,
        requestHeaders,
        responseStatus: response.status,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        success: false,
        errorMessage,
        createdAt: startedAt,
        durationMs: Date.now() - startedAt.getTime(),
      });
      throw new BadGatewayException(`Could not read the 99Food response while trying to ${operation}`);
    }

    let body: NinetyNineResponse | undefined;
    try {
      body = JSON.parse(raw) as NinetyNineResponse;
    } catch {
      body = undefined;
    }

    const errno = body === undefined ? undefined : this.errorNumber(body.errno);
    const success = response.ok && body !== undefined && errno === 0;
    const taskId = auditDetails.operation === 'upload_grocery'
      ? raw.match(/"taskID"\s*:\s*"?([0-9]+)"?/)?.[1]
      : undefined;
    const errorMessage = !response.ok
      ? `99Food returned HTTP ${response.status} while trying to ${operation}`
      : body === undefined
        ? `99Food returned invalid JSON while trying to ${operation}`
        : errno !== 0
          ? body.errmsg ?? `99Food returned errno ${String(body.errno)}`
          : undefined;

    this.audit.recordUpstream({
      ...auditDetails,
      taskId,
      method,
      url,
      requestHeaders,
      responseStatus: response.status,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      responseBody: body,
      responseRawBody: raw,
      success,
      errorMessage,
      createdAt: startedAt,
      durationMs: Date.now() - startedAt.getTime(),
    });

    if (!response.ok) {
      throw new BadGatewayException({
        message: `99Food HTTP error while trying to ${operation}`,
        upstream_status: response.status,
      });
    }
    if (body === undefined) {
      throw new BadGatewayException(`99Food returned invalid JSON while trying to ${operation}`);
    }
    return { body, raw };
  }

  private assertSuccess(response: NinetyNineResponse, operation: string): void {
    if (this.errorNumber(response.errno) !== 0) {
      throw new BadGatewayException({
        message: `99Food rejected the request to ${operation}`,
        upstream_errno: response.errno,
        upstream_message: response.errmsg,
      });
    }
  }

  private errorNumber(errno: number | string): number {
    return Number(errno);
  }
}
