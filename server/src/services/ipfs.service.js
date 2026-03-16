import { createHash } from "crypto";

// Placeholder IPFS upload service.
// Replace with Pinata, Web3.Storage, or your preferred pinning API later.
export async function uploadDocumentToIPFS(documentContent) {
  const digest = createHash("sha256").update(documentContent).digest("hex");
  return `ipfs://${digest}`;
}
