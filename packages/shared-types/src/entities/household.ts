import type { StockStatus } from '../enums/status';

export interface HouseholdItem {
  id: string;
  workspaceId: string;
  name: string;
  category: string;
  status: StockStatus;
  quantity: number | null;
  unit: string | null;
  autoReplenish: boolean;
  lastPurchased: Date | null;
  addedBy: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
