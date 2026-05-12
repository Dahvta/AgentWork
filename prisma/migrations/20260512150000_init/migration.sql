CREATE TYPE "JobState" AS ENUM ('CREATED', 'FUNDED', 'ASSIGNED', 'SUBMITTED', 'VALIDATING', 'COMPLETED', 'DISPUTED', 'CANCELLED');
CREATE TYPE "SettlementState" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

CREATE TABLE "Agent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "wallet" TEXT NOT NULL UNIQUE,
  "metadataUri" TEXT NOT NULL,
  "capabilitiesRoot" TEXT NOT NULL,
  "credentialsRoot" TEXT NOT NULL,
  "isValidator" BOOLEAN NOT NULL DEFAULT false,
  "reputationScoreBps" INTEGER NOT NULL DEFAULT 5000,
  "completedJobs" INTEGER NOT NULL DEFAULT 0,
  "failedJobs" INTEGER NOT NULL DEFAULT 0,
  "validations" INTEGER NOT NULL DEFAULT 0,
  "validationFailures" INTEGER NOT NULL DEFAULT 0,
  "totalEarned" DECIMAL(36,0) NOT NULL DEFAULT 0,
  "totalPaid" DECIMAL(36,0) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Employer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "wallet" TEXT NOT NULL UNIQUE,
  "reputationScoreBps" INTEGER NOT NULL DEFAULT 5000,
  "totalPaid" DECIMAL(36,0) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Job" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractJobId" BIGINT NOT NULL UNIQUE,
  "employerWallet" TEXT NOT NULL REFERENCES "Employer"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE,
  "agentWallet" TEXT REFERENCES "Agent"("wallet") ON DELETE SET NULL ON UPDATE CASCADE,
  "validatorWallet" TEXT REFERENCES "Agent"("wallet") ON DELETE SET NULL ON UPDATE CASCADE,
  "title" TEXT,
  "metadataUri" TEXT NOT NULL,
  "rewardAmount" DECIMAL(36,0) NOT NULL,
  "escrowBalance" DECIMAL(36,0) NOT NULL DEFAULT 0,
  "protocolFeeBps" INTEGER NOT NULL DEFAULT 250,
  "validatorRewardBps" INTEGER NOT NULL DEFAULT 500,
  "deadline" TIMESTAMP(3) NOT NULL,
  "state" "JobState" NOT NULL DEFAULT 'CREATED',
  "deliverableHash" TEXT,
  "validationResult" BOOLEAN,
  "blockNumber" BIGINT,
  "txHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Deliverable" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "submittedBy" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "storageUri" TEXT NOT NULL,
  "mimeType" TEXT,
  "bytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Validation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "validatorWallet" TEXT NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "confidenceBps" INTEGER NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "auditUri" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Settlement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "state" "SettlementState" NOT NULL DEFAULT 'PENDING',
  "agentAmount" DECIMAL(36,0) NOT NULL DEFAULT 0,
  "validatorAmount" DECIMAL(36,0) NOT NULL DEFAULT 0,
  "protocolFee" DECIMAL(36,0) NOT NULL DEFAULT 0,
  "txHash" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ReputationHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "agentWallet" TEXT NOT NULL REFERENCES "Agent"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE,
  "scoreBps" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "txHash" TEXT,
  "blockNumber" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WorkflowEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "txHash" TEXT,
  "logIndex" INTEGER,
  "blockNumber" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "EscrowTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(36,0) NOT NULL,
  "actor" TEXT NOT NULL,
  "txHash" TEXT,
  "blockNumber" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "WorkflowEvent_txHash_logIndex_key" ON "WorkflowEvent"("txHash", "logIndex");
CREATE INDEX "WorkflowEvent_type_createdAt_idx" ON "WorkflowEvent"("type", "createdAt");

