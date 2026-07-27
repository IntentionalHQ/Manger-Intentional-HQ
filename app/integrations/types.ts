export const socialProviders = ["tiktok", "youtube", "instagram"] as const;

export type SocialProvider = (typeof socialProviders)[number];
export type IntegrationStatus = "connected" | "not_connected" | "error";

export type StoredConnection = {
  provider: SocialProvider;
  ownerEmail: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  externalAccountId: string | null;
  externalAccountName: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type TokenBundle = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
};

export type SocialSummary = {
  provider: SocialProvider;
  status: IntegrationStatus;
  configured: boolean;
  accountName: string | null;
  accountId: string | null;
  connectPath: string;
  lastSyncedAt: string | null;
  metrics: Array<{ label: string; value: number | string }>;
  error?: string;
};

export type PublishRequest = {
  caption: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  mode: "draft" | "direct";
  privacy?: string;
  title?: string;
  description?: string;
  tags?: string[];
  scheduledAt?: string | null;
  disableComments?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  shareToFeed?: boolean;
  mediaType?: "video" | "image";
};

export type PublishResult = {
  provider: SocialProvider;
  externalId: string;
  status: string;
  detail?: string;
};

export function isSocialProvider(value: string): value is SocialProvider {
  return socialProviders.includes(value as SocialProvider);
}
