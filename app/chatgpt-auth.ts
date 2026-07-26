import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "../lib/supabase/config";
import { createSupabaseServerClient } from "../lib/supabase/server";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
  authProvider: "chatgpt" | "supabase";
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (email) {
    const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
    const fullName =
      encodedFullName &&
      requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) ===
        PERCENT_ENCODED_UTF8
        ? safeDecodeURIComponent(encodedFullName)
        : null;

    return {
      displayName: fullName ?? email,
      email,
      fullName,
      authProvider: "chatgpt",
    };
  }

  if (!getSupabasePublicConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const fullName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata.name === "string"
        ? user.user_metadata.name
        : null;

  return {
    displayName: fullName ?? user.email,
    email: user.email,
    fullName,
    authProvider: "supabase",
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  if (getSupabasePublicConfig() || (await isAppHostedRequest())) {
    redirect(`/login?returnTo=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`);
  }

  redirect(chatGPTSignInPath(returnTo));
}

export function signOutPathForUser(
  user: ChatGPTUser,
  returnTo = "/",
): string {
  return user.authProvider === "chatgpt"
    ? chatGPTSignOutPath(returnTo)
    : `/auth/signout?returnTo=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export function safeReturnPath(value: string): string {
  return safeRelativeReturnPath(value);
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

async function isAppHostedRequest(): Promise<boolean> {
  if (process.env.VERCEL === "1") return true;

  const requestHeaders = await headers();
  const host = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  )
    .split(":")[0]
    .toLowerCase();

  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
}
