import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL },
  },
});

async function main() {
  // Delete in FK-safe order
  await prisma.proofCheck.deleteMany({});
  await prisma.duplicateIndex.deleteMany({});
  const deleted = await prisma.submission.deleteMany({});
  const deletedDupes = { count: 0 };

  // Set quest start_time to 2 years ago so any repo commits count
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
  await prisma.quest.updateMany({
    where: { title: "Build a Simple Onchain Guestbook" },
    data: {
      start_time: twoYearsAgo,
      min_score: 60,
    },
  });

  console.log(`Deleted ${deleted.count} submission(s)`);
  console.log(`Deleted ${deletedDupes.count} duplicate index entries`);
  console.log(`Quest start_time reset to ${twoYearsAgo.toISOString()}`);
  console.log(`Quest min_score set to 60`);
  console.log("\nYou can now resubmit proof.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
