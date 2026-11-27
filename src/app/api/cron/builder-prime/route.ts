import { NextResponse } from "next/server";
import { secretsMatch } from "@/lib/auth";
import { syncBuilderPrime } from "@/lib/sync";

export const runtime = "nodejs";

async function run(request: Request) {
  const expected = process.env.CRON_SECRET?.trim() ?? "";
  if (!expected) return NextResponse.json({ error: "Set CRON_SECRET before scheduling the nightly sync." }, { status: 503 });
  const header = request.headers.get("x-cron-secret") ?? "";
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secretsMatch(header, expected) && !secretsMatch(bearer, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncBuilderPrime("CRON");
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
