import { PrismaPg } from "@prisma/adapter-pg"
import { databaseUrl } from "@/lib/config/env"
import { PrismaClient } from "@/lib/generated/prisma/client"

const adapter =  new PrismaPg({connectionString : databaseUrl});

export const prisma = new PrismaClient({adapter});

