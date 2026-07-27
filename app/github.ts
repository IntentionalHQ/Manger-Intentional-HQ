import "server-only";

export type GitHubRepository = {
  id: number;
  name: string;
  fullName: string;
  url: string;
  private: boolean;
  openPullRequests: number;
  latestWorkflowStatus: string;
  latestWorkflowAt: string | null;
};

export type GitHubSummary = {
  status: "connected" | "not_connected" | "error";
  repositories: GitHubRepository[];
  openPullRequests: number;
  failingWorkflows: number;
  lastCheckedAt: string;
  error?: string;
};

function config() {
  const appId = process.env.HQ_GITHUB_APP_ID?.trim();
  const installationId = process.env.HQ_GITHUB_INSTALLATION_ID?.trim();
  const privateKey = process.env.HQ_GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  return appId && installationId && privateKey
    ? { appId, installationId, privateKey }
    : null;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function textBase64Url(value: string) {
  return base64Url(new TextEncoder().encode(value));
}

function decodedPemBytes(pem: string) {
  const encoded = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function derLength(length: number) {
  if (length < 128) return Uint8Array.of(length);
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function der(tag: number, content: Uint8Array) {
  const length = derLength(content.byteLength);
  const result = new Uint8Array(1 + length.byteLength + content.byteLength);
  result[0] = tag;
  result.set(length, 1);
  result.set(content, 1 + length.byteLength);
  return result;
}

function concatBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(
    parts.reduce((length, part) => length + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function pemPkcs8Bytes(pem: string) {
  const decoded = decodedPemBytes(pem);
  if (!pem.includes("BEGIN RSA PRIVATE KEY")) return decoded;

  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithmIdentifier = Uint8Array.of(
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
    0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  );
  return der(
    0x30,
    concatBytes(version, rsaAlgorithmIdentifier, der(0x04, decoded)),
  );
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function appJwt(appId: string, privateKey: string) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    arrayBuffer(pemPkcs8Bytes(privateKey)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = textBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = textBase64Url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function githubRequest<T>(
  path: string,
  token: string,
  method = "GET",
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Intentional-HQ",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}.`);
  }
  return (await response.json()) as T;
}

async function installationToken(settings: NonNullable<ReturnType<typeof config>>) {
  const payload = await githubRequest<{ token: string }>(
    `/app/installations/${encodeURIComponent(settings.installationId)}/access_tokens`,
    await appJwt(settings.appId, settings.privateKey),
    "POST",
  );
  return payload.token;
}

export async function readGitHubSummary(): Promise<GitHubSummary> {
  const checkedAt = new Date().toISOString();
  const settings = config();
  if (!settings) {
    return {
      status: "not_connected",
      repositories: [],
      openPullRequests: 0,
      failingWorkflows: 0,
      lastCheckedAt: checkedAt,
      error: "Add the GitHub App ID, installation ID, and private key.",
    };
  }

  try {
    const token = await installationToken(settings);
    const payload = await githubRequest<{
      repositories?: Array<{
        id: number;
        name: string;
        full_name: string;
        html_url: string;
        private: boolean;
      }>;
    }>("/installation/repositories?per_page=100", token);
    const source = payload.repositories ?? [];
    const repositories = await Promise.all(
      source.slice(0, 12).map(async (repository) => {
        const [pulls, runs] = await Promise.all([
          githubRequest<Array<{ id: number }>>(
            `/repos/${repository.full_name}/pulls?state=open&per_page=100`,
            token,
          ),
          githubRequest<{
            workflow_runs?: Array<{
              status?: string;
              conclusion?: string | null;
              updated_at?: string;
            }>;
          }>(
            `/repos/${repository.full_name}/actions/runs?per_page=1`,
            token,
          ),
        ]);
        const latest = runs.workflow_runs?.[0];
        return {
          id: repository.id,
          name: repository.name,
          fullName: repository.full_name,
          url: repository.html_url,
          private: repository.private,
          openPullRequests: pulls.length,
          latestWorkflowStatus:
            latest?.conclusion ?? latest?.status ?? "no runs",
          latestWorkflowAt: latest?.updated_at ?? null,
        };
      }),
    );
    return {
      status: "connected",
      repositories,
      openPullRequests: repositories.reduce(
        (sum, repository) => sum + repository.openPullRequests,
        0,
      ),
      failingWorkflows: repositories.filter((repository) =>
        ["failure", "timed_out", "cancelled", "action_required"].includes(
          repository.latestWorkflowStatus,
        ),
      ).length,
      lastCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      status: "error",
      repositories: [],
      openPullRequests: 0,
      failingWorkflows: 0,
      lastCheckedAt: checkedAt,
      error: error instanceof Error ? error.message : "GitHub monitoring failed.",
    };
  }
}
