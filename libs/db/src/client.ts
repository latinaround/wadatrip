import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './database-url';

let prisma: PrismaClient | undefined;

export function getPrisma() {
  if (!prisma) {
    const { url } = resolveDatabaseUrl();
    prisma = url
      ? new PrismaClient({
          datasources: {
            db: { url },
          },
        })
      : new PrismaClient();
  }
  return prisma;
}

