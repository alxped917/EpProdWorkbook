import "server-only";
import { projectsForStatuses } from "./bp-fixtures";
import type { LooseProject } from "./builder-prime-map";

type Listed = { projects: LooseProject[]; error?: string };

/**
 * Live mode calls Builder Prime's Open API:
 * GET https://{subdomain}.builderprime.com/api/projects/v1
 * Header: x-api-key (scope projects.read)
 * Query: limit (max 100), page (0-based), project-status, last-modified-since (epoch ms)
 */
export async function listBuilderPrimeProjects(input: {
  mode: "mock" | "live";
  subdomain: string;
  statuses: string[];
}): Promise<Listed> {
  if (input.mode === "mock") {
    return { projects: projectsForStatuses(input.statuses) };
  }
  const apiKey = process.env.BUILDER_PRIME_API_KEY?.trim();
  if (!apiKey) {
    return {
      projects: [],
      error: "BUILDER_PRIME_API_KEY is not set. Add it on the server, or switch the integration back to mock mode.",
    };
  }
  const subdomain = input.subdomain.trim().replace(/[^a-z0-9-]/gi, "");
  if (!subdomain) return { projects: [], error: "Builder Prime subdomain is empty." };
  const statuses = input.statuses.length ? input.statuses : [""];
  const projects: LooseProject[] = [];
  for (const status of statuses) {
    for (let page = 0; page < 50; page++) {
      const url = new URL(`https://${subdomain}.builderprime.com/api/projects/v1`);
      url.searchParams.set("limit", "100");
      url.searchParams.set("page", String(page));
      if (status) url.searchParams.set("project-status", status);
      const since = Date.now() - 364 * 24 * 60 * 60 * 1000;
      url.searchParams.set("last-modified-since", String(since));
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { "x-api-key": apiKey, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        return { projects, error: "Could not reach Builder Prime. Check the subdomain and network." };
      }
      if (response.status === 401 || response.status === 403) {
        return { projects, error: `Builder Prime returned ${response.status}. Check that the API key has projects.read.` };
      }
      if (!response.ok) {
        return { projects, error: `Builder Prime returned HTTP ${response.status}.` };
      }
      const body = (await response.json()) as { success?: boolean; data?: unknown; message?: string };
      if (body.success === false) {
        return { projects, error: body.message || "Builder Prime rejected the projects request." };
      }
      const data = Array.isArray(body.data) ? (body.data as LooseProject[]) : [];
      projects.push(...data);
      if (data.length < 100) break;
    }
  }
  return { projects };
}

export async function testBuilderPrimeConnection(mode: "mock" | "live", subdomain: string): Promise<string> {
  if (mode === "mock") return "Mock mode is on. Sample projects are served locally and no API key is used.";
  const result = await listBuilderPrimeProjects({ mode, subdomain, statuses: [] });
  if (result.error) return result.error;
  return `Connected. Builder Prime returned ${result.projects.length} project${result.projects.length === 1 ? "" : "s"}.`;
}
