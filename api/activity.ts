import { readActivity } from "./_lib/chain";
import { sendError, sendJson } from "./_lib/http";

export default async function handler(request: any, response: any) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method not allowed" });
  try {
    sendJson(response, 200, await readActivity());
  } catch (error) {
    sendError(response, error);
  }
}
