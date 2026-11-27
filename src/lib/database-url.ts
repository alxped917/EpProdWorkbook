/** Add serverless pool settings when the URL is Neon’s pooled host or the app is on Vercel. */
export function pooledDatabaseUrl(raw: string | undefined, vercel = process.env.VERCEL): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const pooled = vercel === "1" || url.hostname.includes("-pooler") || url.searchParams.get("pgbouncer") === "true";
    if (pooled) {
      if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
      if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
      if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "15");
    }
    return url.toString();
  } catch {
    return raw;
  }
}
