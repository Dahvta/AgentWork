import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "stdout" },
    { level: "warn", emit: "stdout" },
  ],
});

