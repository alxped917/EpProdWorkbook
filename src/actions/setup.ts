"use server";

import { redirect } from "next/navigation";
import { secretsMatch } from "@/lib/auth";
import { db } from "@/lib/db";
import { runProductionSeed } from "@/lib/seed-core";

export async function runFirstSetup(formData: FormData): Promise<{ error: string } | void> {
  const expected = process.env.SETUP_SECRET?.trim() ?? "";
  if (expected.length < 16) {
    return { error: "Set SETUP_SECRET on Vercel to a random string of at least 16 characters, then redeploy." };
  }
  const provided = String(formData.get("secret") ?? "");
  if (!secretsMatch(provided, expected)) return { error: "That setup code does not match." };
  const result = await runProductionSeed(db, process.env);
  if (!result.ok) return { error: result.error };
  redirect("/login");
}
