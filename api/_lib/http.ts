export function sendJson(response: any, status: number, body: unknown) {
  response.status(status).setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=50");
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body, (_, value) => (typeof value === "bigint" ? value.toString() : value)));
}

export function sendError(response: any, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  sendJson(response, 500, { error: message });
}

