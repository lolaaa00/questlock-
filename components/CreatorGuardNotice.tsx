"use client";

import { usePrivy } from "@privy-io/react-auth";
import { checkCreatorGuard } from "@/lib/creator-guard";

interface Props {
  created_by: string | null;
  sponsor_wallet: string | null;
}

// Renders a clear inline notice above the submit form when the connected
// wallet is the quest's creator or sponsor. The form itself stays mounted
// underneath because we want them to still see the rubric and quest
// configuration, but ProofSubmissionForm's own button gate plus the backend
// 403 in /api/proof/submit are the actual enforcement layers.
export default function CreatorGuardNotice({
  created_by,
  sponsor_wallet,
}: Props) {
  const { authenticated, user } = usePrivy();
  const wallet = user?.wallet?.address;
  if (!authenticated || !wallet) return null;

  const guard = checkCreatorGuard(wallet, { created_by, sponsor_wallet });
  if (!guard.blocked) return null;

  return (
    <div
      className="rounded-xl px-4 py-3 mb-5 text-sm"
      style={{
        background: "#F0DADA",
        border: "1px solid #C9A0A0",
        color: "#5A0000",
      }}
    >
      <p className="font-semibold mb-1">
        You {guard.reason === "creator" ? "created" : "sponsored"} this quest
      </p>
      <p className="text-xs" style={{ color: "#7A2020" }}>
        You cannot submit proof for a quest you created or sponsored.
      </p>
    </div>
  );
}
