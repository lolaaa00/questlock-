"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { baseSepolia } from "viem/chains";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
        appearance: {
          theme: "light",
          accentColor: "#B01020",
          logo: "/logo.svg",
          showWalletLoginFirst: false,
          landingHeader: "Sign in to QuestLock",
        },
        loginMethods: ["email", "google", "wallet"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
        },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
