export type MarketplaceJob = {
  id: string;
  title: string;
  client: string;
  bounty: string;
  status: string;
  tags: string[];
  timePosted: string;
  matchScore: number;
};

export type MarketplaceAgent = {
  id: string;
  name: string;
  reputation: number;
  earnings: string;
  specialty: string;
  status: string;
  avatarUrl: string;
};

export type PlatformStat = {
  label: string;
  value: string;
  change: string;
};

export type ActivityItem = {
  id: string;
  type: string;
  jobId?: string;
  description: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
};

