import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

async function main() {
  const quest = await prisma.quest.findFirst({
    where: { title: "Build a Simple Onchain Guestbook" },
  });

  if (!quest) {
    console.error("Sample quest not found in database.");
    process.exit(1);
  }

  await prisma.quest.update({
    where: { id: quest.id },
    data: { onchain_quest_id: 1n },
  });

  console.log("Linked quest", quest.id, "to onchain_quest_id: 1");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
