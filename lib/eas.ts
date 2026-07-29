import { ethers } from "ethers";

const EAS_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_EAS_CONTRACT_ADDRESS ||
  "0x4200000000000000000000000000000000000021";

// event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schema)
// uid is NOT indexed → lives in log.data, not log.topics
const EAS_ABI = [
  "function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data) request) external payable returns (bytes32)",
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schema)",
];

export interface AttestationInput {
  questId: bigint;
  user: string;
  proofType: string;
  proofHash: `0x${string}`;
  score: number;
  riskBand: string;
  approved: boolean;
}

export async function createAttestation(
  input: AttestationInput
): Promise<string> {
  if (!process.env.VERIFIER_PRIVATE_KEY) {
    throw new Error("VERIFIER_PRIVATE_KEY not set");
  }
  const schemaUID = process.env.NEXT_PUBLIC_EAS_SCHEMA_UID;
  if (!schemaUID) {
    throw new Error("NEXT_PUBLIC_EAS_SCHEMA_UID not set");
  }

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY, provider);

  const issuedAt = BigInt(Math.floor(Date.now() / 1000));

  const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "string", "bytes32", "uint16", "string", "bool", "uint256"],
    [
      input.questId,
      input.user,
      input.proofType,
      input.proofHash,
      input.score,
      input.riskBand,
      input.approved,
      issuedAt,
    ]
  );

  const eas = new ethers.Contract(EAS_CONTRACT_ADDRESS, EAS_ABI, signer);

  const tx = await eas.attest({
    schema: schemaUID,
    data: {
      recipient: input.user,
      expirationTime: 0n,
      revocable: false,
      refUID: ethers.ZeroHash,
      data: encodedData,
      value: 0n,
    },
  });

  const receipt = await tx.wait();

  // Parse Attested event — uid is in log.data (not indexed, not in topics)
  const iface = new ethers.Interface(EAS_ABI);
  let uid = ethers.ZeroHash;

  if (receipt?.logs) {
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed && parsed.name === "Attested") {
          uid = parsed.args.uid;
          break;
        }
      } catch {
        // not this log
      }
    }
  }

  if (uid === ethers.ZeroHash) {
    throw new Error("Failed to extract attestation UID from transaction receipt");
  }

  return uid;
}
