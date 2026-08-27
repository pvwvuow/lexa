import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'], // فقط خطاها — لاگ کوئری هم حجم لاگ را منفجر می‌کند هم سرعت را می‌گیرد
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db