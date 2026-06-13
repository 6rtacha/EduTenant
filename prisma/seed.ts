// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.tenant.upsert({
    where: { slug: "math-elite" },
    update: {},
    create: { name: "수학엘리트학원", slug: "math-elite" },
  });
}

main().then(() => prisma.$disconnect());
