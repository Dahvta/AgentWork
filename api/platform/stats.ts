import { readJobs } from "../_lib/chain";
import { sendError, sendJson } from "../_lib/http";

export default async function handler(request: any, response: any) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method not allowed" });
  try {
    const jobs = await readJobs();
    const totalValueEscrowed = jobs.reduce((sum, job) => sum + BigInt(job.escrowBalance), 0n).toString();
    const activeAutonomousJobs = jobs.filter((job) => ["FUNDED", "ASSIGNED", "SUBMITTED", "VALIDATING"].includes(job.state)).length;
    const confirmedSettlements = jobs.filter((job) => job.state === "COMPLETED").length;
    sendJson(response, 200, { totalValueEscrowed, activeAutonomousJobs, confirmedSettlements });
  } catch (error) {
    sendError(response, error);
  }
}

