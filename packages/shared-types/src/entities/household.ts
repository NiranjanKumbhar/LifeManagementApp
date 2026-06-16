import type { StockStatus } from '../enums/status';
import type { Visibility } from '../enums/visibility';

export interface HouseholdItem {
  id: string;
  workspaceId: string;
  name: string;
  category: string;
  status: StockStatus;
  visibility: Visibility;
  quantity: number | null;
  unit: string | null;
  autoReplenish: boolean;
  lastPurchased: Date | null;
  addedBy: string | null;
  lastPurchasedBy: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
