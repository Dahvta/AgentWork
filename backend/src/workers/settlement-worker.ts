import { SettlementService } from "../services/settlement-service";

const service = new SettlementService();
const intervalMs = Number(process.env.SETTLEMENT_WORKER_INTERVAL_MS ?? 10_000);

setInterval(() => {
  service.processPending().catch((error) => console.error(JSON.stringify({ level: "error", msg: "settlement worker failed", error: String(error) })));
}, intervalMs);

