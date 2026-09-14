export interface Account {
  sub: string;
  email: string;
  roles: string[];
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  diDiConfig: { id: string; appId: string; testModeEnabled: boolean; testShops: string[]; updatedAt: string } | null;
}

export interface DiDiOrderEvent {
  id: string;
  appShopId: string;
  orderId: string;
  orderIndex: number;
  date: string;
  confirmed: boolean;
  confirmError: string | null;
  createdAt: string;
}

export interface ProjectDetail extends Project {
  orderEvents: DiDiOrderEvent[];
}

export interface InventoryUpstreamActivity {
  id?: string;
  sequence: number;
  operation: string;
  storeId: string | null;
  taskId: string | null;
  method?: string;
  url?: string;
  requestHeaders?: unknown;
  requestBody?: unknown;
  responseStatus: number | null;
  responseHeaders?: unknown;
  responseBody?: unknown;
  responseRawBody?: string | null;
  success: boolean;
  errorMessage?: string | null;
  durationMs: number;
  createdAt?: string;
}

export interface InventoryActivityListItem {
  id: string;
  loadType: 'FULL' | 'DELTA' | null;
  method: string;
  path: string;
  sourceIp: string | null;
  userAgent: string | null;
  responseStatus: number | null;
  success: boolean | null;
  errorMessage: string | null;
  recordCount: number | null;
  storeIds: string[];
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
  upstreamCalls: InventoryUpstreamActivity[];
}

export interface InventoryActivityDetail extends InventoryActivityListItem {
  requestHeaders: unknown;
  requestBody: unknown;
  requestRawBody: string | null;
  responseHeaders: unknown;
  responseBody: unknown;
  responseRawBody: string | null;
  upstreamCalls: InventoryUpstreamActivity[];
}

export interface InventoryActivityPage {
  items: InventoryActivityListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InventoryActivityFilters {
  page?: number;
  limit?: number;
  type?: 'FULL' | 'DELTA';
  success?: 'true' | 'false';
  storeId?: string;
  search?: string;
  from?: string;
  to?: string;
}
