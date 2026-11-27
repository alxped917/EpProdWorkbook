import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { can, normalizePermissions, type PermLevel, type PermissionMap, type SectionKey } from "./permissions";
import { authSecretError } from "./seed-plan";

export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-ep_session" : "ep_session";
}

const SESSION_DAYS = 14;

export function requireAuthSecret(): string {
  const error = authSecretError(process.env);
  if (error) throw new Error(error);
  return process.env.AUTH_SECRET!.trim();
}

export function sealSession(token: string): string {
  const sig = createHmac("sha256", requireAuthSecret()).update(token).digest("base64url");
  return `${token}.${sig}`;
}

export function openSession(sealed: string): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || authSecretError(process.env)) return null;
  const dot = sealed.lastIndexOf(".");
  if (dot <= 0) return null;
  const token = sealed.slice(0, dot);
  const sig = sealed.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(token).digest("base64url");
  if (!secretsMatch(sig, expected)) return null;
  return token;
}

export function sessionCookieOptions() {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  };
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  allWarehouses: boolean;
  warehouseIds: string[];
  permissions: PermissionMap;
};

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now = Date.now()): Date {
  return new Date(now + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const sealed = jar.get(sessionCookieName())?.value;
  const token = sealed ? openSession(sealed) : null;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: true, warehouses: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now() || !session.user.active) return null;
  let permissions = normalizePermissions(null);
  try {
    permissions = normalizePermissions(JSON.parse(session.user.role.permissions));
  } catch {
    permissions = normalizePermissions(null);
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roleId: session.user.roleId,
    roleName: session.user.role.name,
    allWarehouses: session.user.allWarehouses,
    warehouseIds: session.user.warehouses.map((row) => row.warehouseId),
    permissions,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePerm(section: SectionKey, level: PermLevel): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.permissions, section, level)) redirect("/forbidden");
  return user;
}

export function seesAllWarehouses(user: CurrentUser): boolean {
  return user.allWarehouses || can(user.permissions, "admin", "edit");
}

export function canSeeWarehouse(user: CurrentUser, warehouseId: string | null | undefined): boolean {
  if (seesAllWarehouses(user)) return true;
  if (!warehouseId) return false;
  return user.warehouseIds.includes(warehouseId);
}

export function warehouseWhere(user: CurrentUser): { in: string[] } | undefined {
  if (seesAllWarehouses(user)) return undefined;
  return { in: user.warehouseIds.length ? user.warehouseIds : ["__none__"] };
}
