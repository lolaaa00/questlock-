import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
  },
});
