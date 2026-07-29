"use client";

import { use } from "react";
import Link from "next/link";
import SponsorFundingPanel from "@/components/SponsorFundingPanel";
import SponsorReviewPanel from "@/components/SponsorReviewPanel";

export default function SponsorQuestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/sponsor" className="text-sm mb-6 inline-block"
          style={{ color: "var(--ql-bear)" }}>← Sponsor home</Link>
        <SponsorFundingPanel questId={id} />
        <SponsorReviewPanel questId={id} />

        <p className="text-xs text-center mt-6" style={{ color: "var(--ql-bear)" }}>
          Funding transactions are signed by your connected wallet.
          No backend keys involved. QuestLockCoreV2 holds the per-quest pool.
        </p>
      </div>
    </div>
  );
}
