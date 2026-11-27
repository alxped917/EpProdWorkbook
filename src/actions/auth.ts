"use server";

import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import {
  getCurrentUser,
  hashToken,
  newSessionToken,
  openSession,
  sealSession,
  sessionCookieName,
  sessionCookieOptions,
  sessionExpiry,
} from "@/lib/auth";
import { homePath, normalizePermissions } from "@/lib/permissions";

export async function login(formData: FormData): Promise<{ error: string } | void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const user = await db.user.findUnique({ where: { email }, include: { role: true } });
  const valid = Boolean(user && user.active && (await compare(password, user.passwordHash)));
  if (!valid || !user) {
    await writeAudit({
      action: "login_failed",
      entityType: "user",
      summary: `Failed sign-in for ${email || "blank email"}`,
    });
    return { error: "Email or password is incorrect." };
  }
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const token = newSessionToken();
  await db.session.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: sessionExpiry() },
  });
  const jar = await cookies();
  jar.set(sessionCookieName(), sealSession(token), sessionCookieOptions());
  await writeAudit({
    userId: user.id,
    userName: user.name,
    action: "login",
    entityType: "user",
    entityId: user.id,
    summary: `${user.name} signed in`,
  });
  let permissions = normalizePermissions(null);
  try {
    permissions = normalizePermissions(JSON.parse(user.role.permissions));
  } catch {
    permissions = normalizePermissions(null);
  }
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : homePath(permissions);
  redirect(dest);
}

export async function logout() {
  const user = await getCurrentUser();
  const jar = await cookies();
  const sealed = jar.get(sessionCookieName())?.value;
  const token = sealed ? openSession(sealed) : null;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(sessionCookieName());
  if (user) {
    await writeAudit({
      userId: user.id,
      userName: user.name,
      action: "logout",
      entityType: "user",
      entityId: user.id,
      summary: `${user.name} signed out`,
    });
  }
  redirect("/login");
}
