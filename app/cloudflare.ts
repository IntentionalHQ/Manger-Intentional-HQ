import "server-only";

export type CloudflareProject = {
  name: string;
  kind: "worker" | "pages";
  status: string;
  url: string | null;
  updatedAt: string | null;
};

export type CloudflareSummary = {
  status: "connected" | "not_connected" | "error";
  projects: CloudflareProject[];
  workerCount: number;
  pagesCount: number;
  healthyCount: number;
  lastCheckedAt: string;
  error?: string;
};

function config() {
  const accountId = process.env.HQ_CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.HQ_CLOUDFLARE_API_TOKEN?.trim();
  return accountId && token ? { accountId, token } : null;
}

async function cloudflareRequest<T>(
  path: string,
  settings: NonNullable<ReturnType<typeof config>>,
): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; result?: T; errors?: Array<{ message?: string }> }
    | null;
  if (!response.ok || !payload?.success) {
    throw new Error(
      payload?.errors?.[0]?.message ?? `Cloudflare API returned ${response.status}.`,
    );
  }
  return payload.result as T;
}

export async function readCloudflareSummary(): Promise<CloudflareSummary> {
  const checkedAt = new Date().toISOString();
  const settings = config();
  if (!settings) {
    return {
      status: "not_connected",
      projects: [],
      workerCount: 0,
      pagesCount: 0,
      healthyCount: 0,
      lastCheckedAt: checkedAt,
      error: "Add the Cloudflare account ID and scoped API token.",
    };
  }

  try {
    const [workers, pages] = await Promise.all([
      cloudflareRequest<Array<{ id?: string; modified_on?: string }>>(
        `/accounts/${settings.accountId}/workers/scripts`,
        settings,
      ),
      cloudflareRequest<
        Array<{
          name?: string;
          domains?: string[];
          canonical_deployment?: {
            url?: string;
            modified_on?: string;
            latest_stage?: { status?: string };
          };
        }>
      >(`/accounts/${settings.accountId}/pages/projects?per_page=100`, settings),
    ]);
    const projects: CloudflareProject[] = [
      ...workers.map((worker) => ({
        name: worker.id ?? "Worker",
        kind: "worker" as const,
        status: "active",
        url: null,
        updatedAt: worker.modified_on ?? null,
      })),
      ...pages.map((project) => ({
        name: project.name ?? "Pages project",
        kind: "pages" as const,
        status: project.canonical_deployment?.latest_stage?.status ?? "unknown",
        url:
          project.domains?.[0]
            ? `https://${project.domains[0]}`
            : project.canonical_deployment?.url ?? null,
        updatedAt: project.canonical_deployment?.modified_on ?? null,
      })),
    ];
    return {
      status: "connected",
      projects,
      workerCount: workers.length,
      pagesCount: pages.length,
      healthyCount: projects.filter((project) =>
        ["active", "success"].includes(project.status),
      ).length,
      lastCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      status: "error",
      projects: [],
      workerCount: 0,
      pagesCount: 0,
      healthyCount: 0,
      lastCheckedAt: checkedAt,
      error:
        error instanceof Error ? error.message : "Cloudflare monitoring failed.",
    };
  }
}
