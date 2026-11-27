import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { can, normalizePermissions, type PermLevel, type PermissionMap, type SectionKey } from "./permissions";

export const SESSION_COOKIE = "ep_session";
const SESSION_DAYS = 14;

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
  const token = jar.get(SESSION_COOKIE)?.value;
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
