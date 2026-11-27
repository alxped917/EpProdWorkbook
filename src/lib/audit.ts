import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

type AuditInput = {
  userId?: string | null;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
};

export async function writeAudit(input: AuditInput, tx: Prisma.TransactionClient | typeof db = db) {
  await tx.auditEvent.create({
    data: {
      userId: input.userId ?? null,
      userName: input.userName ?? "",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? "",
      summary: input.summary.slice(0, 500),
      beforeJson: input.before == null ? "" : JSON.stringify(input.before).slice(0, 4000),
      afterJson: input.after == null ? "" : JSON.stringify(input.after).slice(0, 4000),
    },
  });
}
