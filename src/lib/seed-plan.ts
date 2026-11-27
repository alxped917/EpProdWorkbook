export const DEMO_PASSWORD = "demo-pass-7783";

const PLACEHOLDER_SECRETS = new Set([
  "replace-with-a-long-random-string",
  "dev-only-not-a-real-secret-7783",
  "changeme",
  "secret",
  "password",
  DEMO_PASSWORD,
]);

export type SeedPlan = {
  ok: true;
  production: boolean;
  sample: boolean;
  samplePassword: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
};

export type SeedPlanResult = SeedPlan | { ok: false; error: string };

export type EnvLike = {
  NODE_ENV?: string;
  VERCEL?: string;
  SEED_RESET?: string;
  SEED_SAMPLE_DATA?: string;
  SEED_PASSWORD?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_NAME?: string;
  AUTH_SECRET?: string;
};

export function isProductionEnv(env: EnvLike): boolean {
  return env.NODE_ENV === "production" || env.VERCEL === "1";
}

export function resolveSeedPlan(env: EnvLike): SeedPlanResult {
  const production = isProductionEnv(env);
  if (production && env.SEED_RESET === "true") {
    return { ok: false, error: "SEED_RESET cannot be used on the live site. It would erase jobs and stock." };
  }

  const sampleFlag = env.SEED_SAMPLE_DATA?.trim().toLowerCase();
  const sample = sampleFlag === "true" ? true : sampleFlag === "false" ? false : !production;
  const adminEmail = (env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const adminPassword = env.ADMIN_PASSWORD ?? "";
  const adminName = (env.ADMIN_NAME ?? "").trim();

  if (production) {
    if (!adminEmail || !adminEmail.includes("@")) {
      return { ok: false, error: "Set ADMIN_EMAIL to the email address you will use to sign in." };
    }
    if (adminPassword.length < 12) {
      return { ok: false, error: "Set ADMIN_PASSWORD to a password of at least 12 characters. The app will not invent one." };
    }
    if (PLACEHOLDER_SECRETS.has(adminPassword) || adminPassword === DEMO_PASSWORD) {
      return { ok: false, error: "ADMIN_PASSWORD is a sample password. Choose a different one before creating the live account." };
    }
  }

  let samplePassword = env.SEED_PASSWORD?.trim() || "";
  if (sample) {
    if (production) {
      if (!samplePassword || PLACEHOLDER_SECRETS.has(samplePassword)) {
        return {
          ok: false,
          error: "SEED_SAMPLE_DATA=true also needs SEED_PASSWORD, and it cannot be the demo password.",
        };
      }
    } else if (!samplePassword) {
      samplePassword = DEMO_PASSWORD;
    }
  }

  return {
    ok: true,
    production,
    sample,
    samplePassword,
    adminEmail,
    adminPassword,
    adminName,
  };
}

export function authSecretError(env: EnvLike): string | null {
  const secret = env.AUTH_SECRET?.trim() ?? "";
  if (!isProductionEnv(env)) {
    return secret ? null : "Set AUTH_SECRET in .env. Any long random string is fine on your own computer.";
  }
  if (secret.length < 32 || PLACEHOLDER_SECRETS.has(secret)) {
    return "Set AUTH_SECRET on Vercel to a unique random string of at least 32 characters (openssl rand -base64 32).";
  }
  return null;
}
