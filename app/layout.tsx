import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "QuestLock — Proof-Powered Quest Rewards",
  description:
    "Rewards should follow proof, not farming. Submit GitHub proof, pass deterministic checks, receive on-chain attestation and gasless reward.",
  openGraph: {
    title: "QuestLock",
    description: "Proof-powered quest rewards on Base Sepolia.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Ambient mesh orbs — decorative, fixed behind all content */}
        <div className="ql-mesh" aria-hidden="true">
          <div className="ql-orb ql-orb-1" />
          <div className="ql-orb ql-orb-2" />
        </div>
        <Providers>
          <Navbar />
          <main style={{ position: "relative", zIndex: 1 }}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
