import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ARC_RPC_HTTP_URL: z.string().url(),
  ARC_RPC_WS_URL: z.string().url(),
  JOB_LIFECYCLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  AGENT_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  SETTLEMENT_PRIVATE_KEY: z.string().optional(),
  PINATA_JWT: z.string().optional(),
  IPFS_GATEWAY_URL: z.string().url().default("https://ipfs.io/ipfs"),
});

export const env = EnvSchema.parse(process.env);

