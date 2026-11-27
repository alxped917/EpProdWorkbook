import { describe, expect, it } from "vitest";
import { pooledDatabaseUrl } from "@/lib/database-url";
import { DEMO_PASSWORD, authSecretError, resolveSeedPlan } from "@/lib/seed-plan";

const goodAdmin = {
  ADMIN_EMAIL: "owner@example.com",
  ADMIN_PASSWORD: "correct-horse-battery",
};

describe("production seed rules", () => {
  it("loads sample data on a developer machine and refuses a blank admin password in production", () => {
    const local = resolveSeedPlan({});
    expect(local.ok).toBe(true);
    if (!local.ok) return;
    expect(local.production).toBe(false);
    expect(local.sample).toBe(true);
    expect(local.samplePassword).toBe(DEMO_PASSWORD);

    const missing = resolveSeedPlan({ NODE_ENV: "production" });
    expect(missing.ok).toBe(false);
  });

  it("rejects the demo password and short passwords on the live site", () => {
    expect(
      resolveSeedPlan({ NODE_ENV: "production", ADMIN_EMAIL: "a@b.co", ADMIN_PASSWORD: DEMO_PASSWORD }).ok,
    ).toBe(false);
    expect(
      resolveSeedPlan({ NODE_ENV: "production", ADMIN_EMAIL: "a@b.co", ADMIN_PASSWORD: "short-pass" }).ok,
    ).toBe(false);
    const live = resolveSeedPlan({ NODE_ENV: "production", VERCEL: "1", ...goodAdmin });
    expect(live.ok).toBe(true);
    if (!live.ok) return;
    expect(live.sample).toBe(false);
    expect(live.adminEmail).toBe("owner@example.com");
  });

  it("opts into fake jobs only when SEED_SAMPLE_DATA is true, and still requires a non-demo sample password", () => {
    const blocked = resolveSeedPlan({
      NODE_ENV: "production",
      ...goodAdmin,
      SEED_SAMPLE_DATA: "true",
    });
    expect(blocked.ok).toBe(false);
    const allowed = resolveSeedPlan({
      NODE_ENV: "production",
      ...goodAdmin,
      SEED_SAMPLE_DATA: "true",
      SEED_PASSWORD: "another-long-sample-secret",
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.sample).toBe(true);
    expect(resolveSeedPlan({ SEED_SAMPLE_DATA: "false" }).ok && true).toBe(true);
    const localOff = resolveSeedPlan({ SEED_SAMPLE_DATA: "false" });
    expect(localOff.ok && localOff.sample).toBe(false);
  });

  it("refuses to reset the live database and requires a real AUTH_SECRET", () => {
    const reset = resolveSeedPlan({ NODE_ENV: "production", ...goodAdmin, SEED_RESET: "true" });
    expect(reset.ok).toBe(false);
    expect(authSecretError({ NODE_ENV: "production", AUTH_SECRET: "replace-with-a-long-random-string" })).toMatch(/AUTH_SECRET/);
    expect(authSecretError({ NODE_ENV: "production", AUTH_SECRET: "x".repeat(32) })).toBeNull();
    expect(authSecretError({})).toMatch(/AUTH_SECRET/);
  });

  it("limits Prisma to one connection on a pooled Neon URL", () => {
    const url = pooledDatabaseUrl("postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require", "");
    expect(url).toContain("connection_limit=1");
    expect(url).toContain("pgbouncer=true");
    expect(url).toContain("sslmode=require");
    const local = pooledDatabaseUrl("postgresql://workbook:workbook@localhost:5432/workbook", "");
    expect(local).not.toContain("pgbouncer");
  });
});
