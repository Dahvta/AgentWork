import { readAgents, readJobs } from "../_lib/chain";
import { sendError, sendJson } from "../_lib/http";

export default async function handler(request: any, response: any) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method not allowed" });
  try {
    const [jobs, agents] = await Promise.all([readJobs(), readAgents()]);
    const totalValueEscrowed = jobs.reduce((sum, job) => sum + BigInt(job.escrowBalance), 0n).toString();
    const activeAutonomousJobs = jobs.filter((job) => ["FUNDED", "ASSIGNED", "SUBMITTED", "VALIDATING"].includes(job.state)).length;
    const confirmedSettlements = jobs.filter((job) => job.state === "COMPLETED").length;
    const fundedJobs = jobs.filter((job) => ["FUNDED", "ASSIGNED", "SUBMITTED", "VALIDATING", "COMPLETED"].includes(job.state)).length;
    const disputedJobs = jobs.filter((job) => job.state === "DISPUTED").length;
    const averageReputationScoreBps = agents.length
      ? Math.round(agents.reduce((sum, agent) => sum + agent.reputationScoreBps, 0) / agents.length)
      : 0;
    sendJson(response, 200, {
      totalValueEscrowed,
      activeAutonomousJobs,
      confirmedSettlements,
      totalJobsCreated: jobs.length,
      fundedJobs,
      completedJobs: confirmedSettlements,
      disputedJobs,
      totalSettled: "0",
      totalRegisteredAgents: agents.length,
      averageReputationScoreBps,
    });
  } catch (error) {
    sendError(response, error);
  }
}
