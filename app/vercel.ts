import "server-only";

export type VercelDeployment = {
  id: string;
  url: string;
  status: string;
  target: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  createdAt: string;
  durationMs: number | null;
  projectName: string;
};

export type VercelProject = {
  id: string;
  name: string;
  updatedAt: string;
};

export type VercelSummary = {
  status: "connected" | "not_connected" | "error";
  projectId: string | null;
  projects: VercelProject[];
  deployments: VercelDeployment[];
  successfulCount: number;
  failedCount: number;
  lastCheckedAt: string;
  error?: string;
};

type VercelTeam = {
  id: string;
  slug: string;
};

type VercelApiDeployment = {
  uid?: string;
  id?: string;
  url?: string;
  readyState?: string;
  state?: string;
  target?: string;
  created?: number;
  createdAt?: number;
  buildingAt?: number;
  ready?: number;
  meta?: Record<string, string | undefined>;
  name?: string;
  projectId?: string;
};

async function vercelRequest<T>(
  path: string,
  token: string,
): Promise<T> {
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Vercel API returned ${response.status}.`);
  }
  return (await response.json()) as T;
}

async function resolveTeamId(token: string): Promise<string | null> {
  if (process.env.HQ_VERCEL_TEAM_ID) return process.env.HQ_VERCEL_TEAM_ID;

  const payload = await vercelRequest<{ teams?: VercelTeam[] }>(
    "/v2/teams?limit=100",
    token,
  );
  const teams = payload.teams ?? [];
  const preferredSlug =
    process.env.HQ_VERCEL_TEAM_SLUG?.trim() || "intentional-hq";
  return (
    teams.find((team) => team.slug === preferredSlug)?.id ??
    (teams.length === 1 ? teams[0].id : null)
  );
}

function deploymentTimestamp(value: number | undefined): string {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function normalizeDeployment(
  deployment: VercelApiDeployment,
): VercelDeployment {
  const meta = deployment.meta ?? {};
  const startedAt = deployment.buildingAt;
  const readyAt = deployment.ready;
  const durationMs =
    startedAt && readyAt && readyAt >= startedAt ? readyAt - startedAt : null;

  return {
    id: deployment.uid ?? deployment.id ?? "unknown",
    url: deployment.url ? `https://${deployment.url}` : "",
    status: (deployment.readyState ?? deployment.state ?? "UNKNOWN").toLowerCase(),
    target: deployment.target ?? "unknown",
    branch: meta.githubCommitRef ?? meta.gitCommitRef ?? "unknown",
    commitSha: meta.githubCommitSha ?? meta.gitCommitSha ?? "",
    commitMessage:
      meta.githubCommitMessage ?? meta.gitCommitMessage ?? "Deployment",
    createdAt: deploymentTimestamp(deployment.created ?? deployment.createdAt),
    durationMs,
    projectName: deployment.name ?? deployment.projectId ?? "Vercel project",
  };
}

export async function readVercelSummary(): Promise<VercelSummary> {
  const token = process.env.HQ_VERCEL_TOKEN?.trim();
  const projectId =
    process.env.VERCEL_PROJECT_ID?.trim() ??
    process.env.HQ_VERCEL_PROJECT_ID?.trim() ??
    null;
  const lastCheckedAt = new Date().toISOString();

  if (!token) {
    return {
      status: "not_connected",
      projectId,
      projects: [],
      deployments: [],
      successfulCount: 0,
      failedCount: 0,
      lastCheckedAt,
      error: "Add HQ_VERCEL_TOKEN to enable deployment monitoring.",
    };
  }

  try {
    const teamId = await resolveTeamId(token);
    const query = new URLSearchParams({ limit: "50" });
    const projectQuery = new URLSearchParams({ limit: "100" });
    if (teamId) {
      query.set("teamId", teamId);
      projectQuery.set("teamId", teamId);
    }

    const [payload, projectPayload] = await Promise.all([
      vercelRequest<{ deployments?: VercelApiDeployment[] }>(
        `/v6/deployments?${query.toString()}`,
        token,
      ),
      vercelRequest<{
        projects?: Array<{ id?: string; name?: string; updatedAt?: number }>;
      }>(`/v9/projects?${projectQuery.toString()}`, token),
    ]);
    const deployments = (payload.deployments ?? []).map(normalizeDeployment);
    const projects = (projectPayload.projects ?? []).map((project) => ({
      id: project.id ?? project.name ?? "unknown",
      name: project.name ?? "Vercel project",
      updatedAt: deploymentTimestamp(project.updatedAt),
    }));

    return {
      status: "connected",
      projectId: projectId ?? projects[0]?.id ?? null,
      projects,
      deployments,
      successfulCount: deployments.filter(
        (deployment) => deployment.status === "ready",
      ).length,
      failedCount: deployments.filter((deployment) =>
        ["error", "canceled"].includes(deployment.status),
      ).length,
      lastCheckedAt,
    };
  } catch (error) {
    return {
      status: "error",
      projectId,
      projects: [],
      deployments: [],
      successfulCount: 0,
      failedCount: 0,
      lastCheckedAt,
      error:
        error instanceof Error
          ? error.message
          : "Vercel deployment monitoring failed.",
    };
  }
}
