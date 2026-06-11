export interface GiftIdea {
  idea: string;
  budget?: number;
  purchased?: boolean;
  url?: string;
}

export interface Person {
  id: string;
  workspaceId: string;
  name: string;
  relationship: string | null;
  birthday: string | null;    // ISO date string (YYYY-MM-DD)
  anniversary: string | null; // ISO date string
  email: string | null;
  phone: string | null;
  notes: string | null;
  giftIdeas: GiftIdea[];
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
