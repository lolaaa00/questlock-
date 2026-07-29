import { createHash } from "crypto";
import { prisma } from "./prisma";

export type RiskBand = "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK";

export interface AntiFarmResult {
  riskBand: RiskBand;
  reasons: string[];
  duplicateRepo: boolean;
  duplicateDemoUrl: boolean;
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

export async function runAntiFarmChecks(params: {
  questId: string;
  walletAddress: string;
  githubUsername: string;
  repoUrl: string;
  demoUrl?: string;
}): Promise<AntiFarmResult> {
  const { questId, walletAddress, githubUsername, repoUrl, demoUrl } = params;
  const reasons: string[] = [];
  let riskScore = 0;
  let duplicateRepo = false;
  let duplicateDemoUrl = false;

  const repoHash = hashValue(repoUrl);
  const usernameHash = hashValue(githubUsername);
  const demoHash = demoUrl ? hashValue(demoUrl) : null;

  // Check duplicate repo for same quest
  const existingRepo = await prisma.duplicateIndex.findFirst({
    where: { quest_id: questId, repo_url_hash: repoHash },
  });
  if (existingRepo && existingRepo.wallet_address !== walletAddress) {
    duplicateRepo = true;
    riskScore += 50;
    reasons.push("This repository has already been submitted for this quest by another wallet.");
  }

  // Check duplicate demo URL for same quest
  if (demoHash) {
    const existingDemo = await prisma.duplicateIndex.findFirst({
      where: { quest_id: questId, demo_url_hash: demoHash },
    });
    if (existingDemo && existingDemo.wallet_address !== walletAddress) {
      duplicateDemoUrl = true;
      riskScore += 50;
      reasons.push("This demo URL has already been submitted for this quest by another wallet.");
    }
  }

  // Check if GitHub username is linked to multiple wallets
  const usernameEntries = await prisma.duplicateIndex.findMany({
    where: { github_username_hash: usernameHash },
    select: { wallet_address: true },
  });
  const uniqueWallets = new Set(usernameEntries.map((e) => e.wallet_address));
  if (uniqueWallets.size >= 3) {
    riskScore += 30;
    reasons.push(
      `GitHub username is linked to ${uniqueWallets.size} different wallets.`
    );
  }

  // Check if wallet already submitted this quest
  const existingSubmission = await prisma.submission.findUnique({
    where: {
      quest_id_wallet_address: {
        quest_id: questId,
        wallet_address: walletAddress,
      },
    },
  });
  if (existingSubmission) {
    riskScore += 40;
    reasons.push("This wallet has already submitted proof for this quest.");
  }

  // Determine risk band
  let riskBand: RiskBand;
  if (riskScore >= 50 || duplicateRepo || duplicateDemoUrl) {
    riskBand = "HIGH_RISK";
  } else if (riskScore >= 20) {
    riskBand = "MEDIUM_RISK";
  } else {
    riskBand = "LOW_RISK";
  }

  return { riskBand, reasons, duplicateRepo, duplicateDemoUrl };
}
