import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

async function main() {
  const updated = await prisma.quest.updateMany({
    where: { title: "Build a Simple Onchain Guestbook" },
    data: { min_score: 60 },
  });
  console.log(`Updated ${updated.count} quest(s) to min_score: 60`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
