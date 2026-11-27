import { NextResponse } from "next/server";
import { secretsMatch } from "@/lib/auth";
import { importBuilderPrimeProjects } from "@/lib/sync";
import type { LooseProject } from "@/lib/builder-prime-map";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.BUILDER_PRIME_WEBHOOK_SECRET?.trim() ?? "";
  if (!expected) {
    return NextResponse.json({ error: "Webhook is disabled until BUILDER_PRIME_WEBHOOK_SECRET is set." }, { status: 503 });
  }
  const url = new URL(request.url);
  let body: LooseProject = {};
  try {
    body = (await request.json()) as LooseProject;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const provided = request.headers.get("x-webhook-secret") || url.searchParams.get("secret") || String(body.webhookSecret ?? "");
  if (!secretsMatch(provided, expected)) return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  delete body.webhookSecret;
  const result = await importBuilderPrimeProjects([body], "WEBHOOK");
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
