import "server-only";

import {
  exchangeInstagramCode,
  instagramAuthorizationUrl,
  publishInstagram,
  readInstagramContainerStatus,
  readInstagramSummary,
} from "./instagram";
import {
  publishTikTok,
  readTikTokPublishStatus,
  readTikTokSummary,
  tiktokAuthorizationUrl,
} from "./tiktok";
import type {
  PublishRequest,
  PublishResult,
  SocialProvider,
  SocialSummary,
} from "./types";
import {
  exchangeTikTokCode,
} from "./tiktok";
import {
  exchangeYouTubeCode,
  publishYouTube,
  readYouTubeSummary,
  youtubeAuthorizationUrl,
} from "./youtube";

export function authorizationUrl(
  provider: SocialProvider,
  requestUrl: string,
  state: string,
) {
  if (provider === "tiktok") {
    return tiktokAuthorizationUrl(requestUrl, state);
  }
  if (provider === "youtube") {
    return youtubeAuthorizationUrl(requestUrl, state);
  }
  return instagramAuthorizationUrl(requestUrl, state);
}

export async function exchangeAuthorizationCode(
  provider: SocialProvider,
  ownerEmail: string,
  code: string,
  requestUrl: string,
) {
  if (provider === "tiktok") {
    return exchangeTikTokCode(ownerEmail, code, requestUrl);
  }
  if (provider === "youtube") {
    return exchangeYouTubeCode(ownerEmail, code, requestUrl);
  }
  return exchangeInstagramCode(ownerEmail, code, requestUrl);
}

export async function readSocialSummaries(
  ownerEmail: string,
): Promise<SocialSummary[]> {
  return Promise.all([
    readTikTokSummary(ownerEmail),
    readYouTubeSummary(ownerEmail),
    readInstagramSummary(ownerEmail),
  ]);
}

export async function publishToProvider(
  provider: SocialProvider,
  ownerEmail: string,
  request: PublishRequest,
): Promise<PublishResult> {
  if (provider === "tiktok") return publishTikTok(ownerEmail, request);
  if (provider === "youtube") return publishYouTube(ownerEmail, request);
  return publishInstagram(ownerEmail, request);
}

export async function readPublishStatus(
  provider: SocialProvider,
  ownerEmail: string,
  externalId: string,
) {
  if (provider === "tiktok") {
    return readTikTokPublishStatus(ownerEmail, externalId);
  }
  if (provider === "instagram") {
    return readInstagramContainerStatus(ownerEmail, externalId);
  }
  return { id: externalId, status: "Use YouTube processing status in Studio." };
}
