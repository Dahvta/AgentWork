import { createHash } from "node:crypto";
import { env } from "../config/env";

export type StoredObject = {
  contentHash: string;
  storageUri: string;
  bytes: number;
};

export class StorageService {
  hash(buffer: Buffer) {
    return `0x${createHash("sha256").update(buffer).digest("hex")}`;
  }

  async pinJson(value: unknown): Promise<StoredObject> {
    const body = Buffer.from(JSON.stringify(value));
    const contentHash = this.hash(body);
    if (!env.PINATA_JWT) {
      return { contentHash, storageUri: `sha256://${contentHash}`, bytes: body.length };
    }
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PINATA_JWT}`, "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) throw new Error(`IPFS pin failed: ${response.status} ${await response.text()}`);
    const pinned = (await response.json()) as { IpfsHash: string };
    return { contentHash, storageUri: `ipfs://${pinned.IpfsHash}`, bytes: body.length };
  }

  async pinBuffer(buffer: Buffer, filename: string, mimeType = "application/octet-stream"): Promise<StoredObject> {
    const contentHash = this.hash(buffer);
    if (!env.PINATA_JWT) {
      return { contentHash, storageUri: `sha256://${contentHash}`, bytes: buffer.length };
    }
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), filename);
    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PINATA_JWT}` },
      body: form,
    });
    if (!response.ok) throw new Error(`IPFS file pin failed: ${response.status} ${await response.text()}`);
    const pinned = (await response.json()) as { IpfsHash: string };
    return { contentHash, storageUri: `ipfs://${pinned.IpfsHash}`, bytes: buffer.length };
  }

  verify(buffer: Buffer, expectedHash: string) {
    return this.hash(buffer).toLowerCase() === expectedHash.toLowerCase();
  }
}
