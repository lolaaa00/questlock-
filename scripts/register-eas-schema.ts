import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_REGISTRY = "0x4200000000000000000000000000000000000020";
const SCHEMA_STRING =
  "uint256 questId,address user,string proofType,bytes32 proofHash,uint16 score,string riskBand,bool approved,uint256 issuedAt";

const REGISTRY_ABI = [
  "function register(string calldata schema, address resolver, bool revocable) external returns (bytes32)",
];

async function main() {
  if (!process.env.VERIFIER_PRIVATE_KEY) {
    throw new Error("VERIFIER_PRIVATE_KEY not set in .env");
  }

  const rpcUrl = "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY, provider);

  console.log("Registering EAS schema with wallet:", signer.address);
  console.log("Schema:", SCHEMA_STRING);

  const registry = new ethers.Contract(SCHEMA_REGISTRY, REGISTRY_ABI, signer);

  const tx = await registry.register(
    SCHEMA_STRING,
    ethers.ZeroAddress,
    false
  );
  console.log("Transaction sent:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();

  // The schema UID is in the logs — it's the first topic of the Registered event
  let schemaUID = "";
  if (receipt && receipt.logs && receipt.logs.length > 0) {
    schemaUID = receipt.logs[0].topics[1];
  }

  if (!schemaUID) {
    console.log("Tx hash:", receipt?.hash);
    console.log("Could not auto-extract UID from logs. Check BaseScan for the schema UID.");
    console.log(`https://sepolia.basescan.org/tx/${receipt?.hash}`);
    return;
  }

  console.log("\n=== EAS SCHEMA REGISTERED ===");
  console.log("Schema UID:", schemaUID);
  console.log("\nAdd this to your .env:");
  console.log(`NEXT_PUBLIC_EAS_SCHEMA_UID=${schemaUID}`);

  // Save to deployments file
  const deploymentsPath = path.join(__dirname, "..", "deployments", "baseSepolia.json");
  if (fs.existsSync(deploymentsPath)) {
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
    deployments.NEXT_PUBLIC_EAS_SCHEMA_UID = schemaUID;
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
    console.log("Saved to deployments/baseSepolia.json");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
