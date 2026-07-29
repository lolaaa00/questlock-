import { baseSepolia } from "viem/chains";
import type { Chain } from "viem";

export const SUPPORTED_CHAIN = baseSepolia;
export const CHAIN_ID = 84532;

export function getChain(): Chain {
  return baseSepolia;
}

export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";
export const EAS_SCAN_BASE_SEPOLIA = "https://base-sepolia.easscan.org";

export function explorerTxUrl(hash: string): string {
  return `${BASE_SEPOLIA_EXPLORER}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${BASE_SEPOLIA_EXPLORER}/address/${address}`;
}

export function easAttestationUrl(uid: string): string {
  return `${EAS_SCAN_BASE_SEPOLIA}/attestation/view/${uid}`;
}
