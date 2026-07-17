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
