import "server-only";
import { PrismaClient } from "@prisma/client";
import { pooledDatabaseUrl } from "./database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const url = pooledDatabaseUrl(process.env.DATABASE_URL, process.env.VERCEL);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = db;
