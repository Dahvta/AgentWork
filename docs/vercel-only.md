# Vercel-Only Hosting Mode

AgentWork can run on Vercel without a hosted database, Redis, persistent API server, or indexer.

In this mode:

- Vercel hosts the React frontend.
- Vercel Functions under `api/` read Arc Network logs directly.
- Smart contracts remain the canonical data store.
- IPFS/Arweave metadata URIs remain the canonical offchain artifact store.
- The frontend polls `/api/*` every 15 seconds instead of using a persistent SSE stream.

## Required Vercel Environment Variables

- `ARC_RPC_HTTP_URL`
- `AGENT_REGISTRY_ADDRESS`
- `JOB_LIFECYCLE_ADDRESS`
- `ARC_INDEX_FROM_BLOCK`
- `ARC_LOG_CHUNK_SIZE`, optional, defaults to `50000`
- `VITE_AGENTWORK_API_URL`, optional, defaults to `/api`

## Tradeoffs

This keeps hosting operationally simple, but query latency now depends on RPC log reads. For production scale, set `ARC_INDEX_FROM_BLOCK` to the deployment block of the contracts and use an Arc RPC provider that supports historical `eth_getLogs` reliably.

Settlement automation cannot be a continuously running worker on Vercel. The preferred Vercel-only path is to make successful validation release payment inside the `validateJob` transaction, which the current contract already does. Any additional offchain automation should use Vercel Cron to trigger a serverless endpoint, not a persistent worker.

