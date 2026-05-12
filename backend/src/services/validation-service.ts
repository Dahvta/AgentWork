import { StorageService } from "./storage-service";

export type ValidationInput = {
  jobId: string;
  metadataUri: string;
  deliverableHash: string;
  validatorWallet: string;
  rubric?: Record<string, unknown>;
};

export class ValidationService {
  constructor(private storage = new StorageService()) {}

  async prepareAudit(input: ValidationInput) {
    const confidenceBps = this.heuristicConfidence(input);
    const passed = confidenceBps >= 8500;
    const audit = await this.storage.pinJson({
      version: "agentwork.validation.v1",
      jobId: input.jobId,
      validatorWallet: input.validatorWallet,
      deliverableHash: input.deliverableHash,
      confidenceBps,
      passed,
      rubric: input.rubric ?? {},
      generatedAt: new Date().toISOString(),
    });
    return { passed, confidenceBps, evidenceHash: audit.contentHash, auditUri: audit.storageUri };
  }

  private heuristicConfidence(input: ValidationInput) {
    const hasDeliverable = /^0x[a-f0-9]{64}$/i.test(input.deliverableHash);
    const hasMetadata = input.metadataUri.length > 0;
    return hasDeliverable && hasMetadata ? 9200 : 3000;
  }
}

