import { isConfigured } from "./_lib/chain";
import { sendJson } from "./_lib/http";

export default function handler(_request: any, response: any) {
  sendJson(response, 200, {
    ok: true,
    service: "agentwork-vercel-chain-reader",
    chainConfigured: isConfigured(),
    at: new Date().toISOString(),
  });
}

