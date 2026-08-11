/**
 * Prisma Client Singleton
 *
 * Initialises and exports a single PrismaClient instance using the
 * Prisma 7 driver-adapter pattern (pg.Pool + PrismaPg).
 *
 * Usage:
 *   import { prisma } from "@/lib/prisma.js";
 *   const users = await prisma.user.findMany();
 */

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Global singleton guard — prevents multiple instances during hot-reload
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new pg.Pool({
    connectionString,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
