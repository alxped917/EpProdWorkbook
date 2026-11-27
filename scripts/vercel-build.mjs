import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const PLACEHOLDERS = new Set([
  "replace-with-a-long-random-string",
  "dev-only-not-a-real-secret-7783",
  "changeme",
  "secret",
  "password",
  "demo-pass-7783",
]);

function first(...values) {
  return values.map((value) => value?.trim()).find(Boolean) ?? "";
}

process.env.DATABASE_URL = first(
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
);
process.env.DIRECT_URL = first(
  process.env.DIRECT_URL,
  process.env.DATABASE_URL_UNPOOLED,
  process.env.POSTGRES_URL_NON_POOLING,
);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Connect Neon in Vercel Storage, or start local Postgres.");
  process.exit(1);
}
if (!process.env.DIRECT_URL) {
  const pooled = process.env.DATABASE_URL.includes("-pooler") || process.env.DATABASE_URL.includes("pgbouncer=true");
  if (pooled) {
    console.error(
      "DIRECT_URL is missing. Neon’s pooled URL cannot run migrations. Set DIRECT_URL to DATABASE_URL_UNPOOLED (the connection string whose host does not contain -pooler).",
    );
    process.exit(1);
  }
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

if (process.env.VERCEL === "1") {
  const auth = process.env.AUTH_SECRET?.trim() ?? "";
  if (auth.length < 32 || PLACEHOLDERS.has(auth)) {
    console.error("Set AUTH_SECRET on Vercel to a unique random string of at least 32 characters.");
    process.exit(1);
  }
  const cron = process.env.CRON_SECRET?.trim() ?? "";
  if (cron.length < 16 || PLACEHOLDERS.has(cron)) {
    console.error("Set CRON_SECRET on Vercel. Vercel sends it as Authorization: Bearer on the nightly sync.");
    process.exit(1);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["next", "build"]);
