import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { JobDetailSheet } from "./components/JobDetailSheet";
import { AgentProfileSheet } from "./components/AgentProfileSheet";
import { JobCardSkeleton, AgentCardSkeleton, StatCardSkeleton, ActivityItemSkeleton } from "./components/Skeletons";
import {
  Search,
  Activity,
  Terminal,
  Cpu,
  Layers,
  ArrowRight,
  TrendingUp,
  Zap,
  Globe,
  Plus,
  ShieldCheck,
  MoreHorizontal,
  Wallet,
  CheckCircle2,
  FileText,
  ServerCog,
  ExternalLink,
  PlayCircle
} from "lucide-react";
import { PLATFORM_STATS, MOCK_JOBS, MOCK_AGENTS, MOCK_ACTIVITY } from "./data";
import { loadActivity, loadMarketplace, subscribeMarketplace } from "./lib/agentwork-api";
import { connectWallet, getWalletState, shortAddress, subscribeWallet } from "./lib/wallet";
import {
  acceptJobOnchain,
  createAndFundJobOnchain,
  getConnectedUsdcBalance,
  metadataUriForAgent,
  metadataUriForJob,
  registerAgentOnchain,
} from "./lib/onchain";
import { explorerTxUrl } from "./lib/protocol";
import type { ActivityItem } from "./lib/types";
import architectureDoc from "../docs/architecture.md?raw";
import apiDoc from "../docs/api.md?raw";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOCAL_BOUNTIES_KEY = "agentwork.localBounties";
const LOCAL_AGENTS_KEY = "agentwork.localAgents";
const LOCAL_PROPOSALS_KEY = "agentwork.localProposals";
const DEMO_MODE_KEY = "agentwork.demoMode";
type Job = (typeof MOCK_JOBS)[number];
type Agent = (typeof MOCK_AGENTS)[number];
type Proposal = {
  id: string;
  jobId: string;
  agentName: string;
  summary: string;
  timeline: string;
  submittedAt: string;
};
const DOCS = [
  {
    title: "Architecture",
    body: "Onchain source of truth, indexer, worker, and settlement design.",
    content: architectureDoc,
  },
  {
    title: "API",
    body: "Jobs, agents, platform stats, and live marketplace reads.",
    content: apiDoc,
  },
];

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`${part}-${index}`} className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[0.85em] text-primary">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
}

function MarkdownReader({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="space-y-2 rounded-lg border border-border/40 bg-white/[0.03] p-4">
        {listItems.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{renderInlineMarkdown(item)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={index} className="text-3xl font-heading font-medium text-white">
          {trimmed.slice(2)}
        </h1>
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={index} className="pt-4 text-xl font-semibold text-white">
          {trimmed.slice(3)}
        </h2>
      );
      return;
    }

    blocks.push(
      <p key={index} className="text-sm leading-7 text-muted-foreground">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });

  flushList();
  return <div className="space-y-5">{blocks}</div>;
}

function loadLocalBounties(): Job[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_BOUNTIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalBounties(jobs: Job[]) {
  window.localStorage.setItem(LOCAL_BOUNTIES_KEY, JSON.stringify(jobs));
}

function loadLocalAgents(): Agent[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_AGENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAgents(agents: Agent[]) {
  window.localStorage.setItem(LOCAL_AGENTS_KEY, JSON.stringify(agents));
}

function loadLocalProposals(): Proposal[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_PROPOSALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalProposals(proposals: Proposal[]) {
  window.localStorage.setItem(LOCAL_PROPOSALS_KEY, JSON.stringify(proposals));
}

function mergeJobs(localJobs: Job[], remoteJobs: Job[]) {
  const localIds = new Set(localJobs.map((job) => job.id));
  return [...localJobs, ...remoteJobs.filter((job) => !localIds.has(job.id))];
}

function mergeAgents(localAgents: Agent[], remoteAgents: Agent[]) {
  const localIds = new Set(localAgents.map((agent) => agent.id));
  return [...localAgents, ...remoteAgents.filter((agent) => !localIds.has(agent.id))];
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "shortMessage" in error) {
    return String((error as { shortMessage: unknown }).shortMessage);
  }
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Blockchain transaction failed.";
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function relativeEventTime(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function App() {
  const [activeView, setActiveView] = useState("marketplace");
  const [activeTab, setActiveTab] = useState("jobs");
  const [demoMode, setDemoMode] = useState(() => window.localStorage.getItem(DEMO_MODE_KEY) !== "false");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [localBounties, setLocalBounties] = useState<Job[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [localAgents, setLocalAgents] = useState<Agent[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState(PLATFORM_STATS);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletUsdcBalance, setWalletUsdcBalance] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [chainStatus, setChainStatus] = useState<string | null>(null);
  const [chainStatusTx, setChainStatusTx] = useState<string | null>(null);
  const [isPostBountyOpen, setIsPostBountyOpen] = useState(false);
  const [isDeployAgentOpen, setIsDeployAgentOpen] = useState(false);
  const [isProposalFormOpen, setIsProposalFormOpen] = useState(false);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<(typeof DOCS)[number] | null>(null);
  const [activeJobDetails, setActiveJobDetails] = useState<Job | null>(null);
  const [activeNodeDetails, setActiveNodeDetails] = useState<Agent | null>(null);
  const [bountyForm, setBountyForm] = useState({
    title: "",
    description: "",
    bounty: "",
    tags: "",
    skills: "",
    deadlineDays: "7",
  });
  const [agentForm, setAgentForm] = useState({
    name: "",
    description: "",
    specialty: "",
    skills: "",
    status: "Active",
  });
  const [proposalForm, setProposalForm] = useState({
    agentName: "",
    summary: "",
    timeline: "",
    validator: "",
  });

  useEffect(() => {
    let mounted = true;
    const savedBounties = loadLocalBounties();
    const savedAgents = loadLocalAgents();
    const savedProposals = loadLocalProposals();
    setLocalBounties(savedBounties);
    setLocalAgents(savedAgents);
    setProposals(savedProposals);
    const refresh = () => {
      Promise.all([loadMarketplace(), loadActivity()]).then(([marketplace, nextActivity]) => {
        if (!mounted) return;
        setJobs(marketplace.jobs);
        setAgents(marketplace.agents);
        setStats(marketplace.stats);
        setActivity(nextActivity);
        setIsLive(marketplace.live);
        setIsLoading(false);
      });
    };
    refresh();
    const unsubscribe = subscribeMarketplace(refresh);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DEMO_MODE_KEY, String(demoMode));
  }, [demoMode]);

  useEffect(() => {
    let mounted = true;
    const syncWallet = () => {
      getWalletState().then((state) => {
        if (!mounted) return;
        setWalletAddress(state.address);
        setWalletError(state.error);
        if (state.address) {
          getConnectedUsdcBalance(state.address).then((balance) => {
            if (mounted) setWalletUsdcBalance(balance);
          }).catch(() => mounted && setWalletUsdcBalance(null));
        } else {
          setWalletUsdcBalance(null);
        }
      });
    };
    syncWallet();
    const unsubscribe = subscribeWallet(syncWallet);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleConnectWallet = async () => {
    setIsConnectingWallet(true);
    setWalletError(null);
    const state = await connectWallet();
    setWalletAddress(state.address);
    setWalletError(state.error);
    setWalletUsdcBalance(state.address ? await getConnectedUsdcBalance(state.address).catch(() => null) : null);
    setIsConnectingWallet(false);
  };

  const handlePostBounty = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void postBountyOnchain();
  };

  const postBountyOnchain = async () => {
    const title = bountyForm.title.trim();
    const bounty = bountyForm.bounty.trim();
    if (!title || !bounty) return;

    const nextJobNumber = Math.max(
      ...[...localBounties, ...jobs].map((job) => Number(job.id.replace(/\D/g, ""))).filter(Number.isFinite),
      9482
    ) + 1;
    const parsedTags = bountyForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setChainStatus("Confirm create job, USDC approval, and escrow funding in your wallet.");
    let receipt;
    try {
      receipt = await createAndFundJobOnchain({
        rewardAmount: bounty,
        deadlineDays: Number(bountyForm.deadlineDays) || 7,
        metadataURI: metadataUriForJob(title, parsedTags, bountyForm.description.trim(), bountyForm.skills.trim()),
      });
    } catch (error) {
      setChainStatus(errorMessage(error));
      return;
    }

    const newJob = {
      id: receipt.jobId ?? `JOB-${nextJobNumber}`,
      title,
      client: walletAddress ? shortAddress(walletAddress) : "Draft Client",
      bounty: bounty.toUpperCase().includes("USDC") ? bounty : `${bounty} USDC`,
      status: "Open",
      tags: parsedTags.length ? parsedTags : ["New", "USDC"],
      timePosted: "just now",
      matchScore: 91,
    };
    setLocalBounties((current) => {
      const next = [newJob, ...current];
      saveLocalBounties(next);
      return next;
    });
    setJobs((currentJobs) => mergeJobs([newJob], currentJobs));
    setBountyForm({ title: "", description: "", bounty: "", tags: "", skills: "", deadlineDays: "7" });
    setActiveView("marketplace");
    setActiveTab("jobs");
    setChainStatus(`Bounty funded onchain: ${shortHash(receipt.hash)}`);
    setChainStatusTx(receipt.hash);
    setIsPostBountyOpen(false);
  };

  const handleDeployAgent = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void deployAgentOnchain();
  };

  const deployAgentOnchain = async () => {
    const name = agentForm.name.trim();
    const specialty = agentForm.specialty.trim();
    if (!name || !specialty) return;

    const nextAgentNumber = Math.max(
      ...[...localAgents, ...agents].map((agent) => Number(agent.id.replace(/\D/g, ""))).filter(Number.isFinite),
      7
    ) + 1;
    setChainStatus("Confirm agent registration in your wallet.");
    let receipt;
    try {
      receipt = await registerAgentOnchain(metadataUriForAgent(name, specialty, agentForm.status, agentForm.description.trim(), agentForm.skills.trim()));
    } catch (error) {
      setChainStatus(errorMessage(error));
      return;
    }

    const newAgent = {
      id: `AGT-${nextAgentNumber}`,
      name,
      reputation: 4.75,
      earnings: "0 USDC",
      specialty,
      status: agentForm.status,
      avatarUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(name)}`,
    };
    setLocalAgents((current) => {
      const next = [newAgent, ...current];
      saveLocalAgents(next);
      return next;
    });
    setAgents((currentAgents) => mergeAgents([newAgent], currentAgents));
    setAgentForm({ name: "", description: "", specialty: "", skills: "", status: "Active" });
    setActiveView("marketplace");
    setActiveTab("agents");
    setChainStatus(`Agent registered onchain: ${shortHash(receipt.hash)}`);
    setChainStatusTx(receipt.hash);
    setIsDeployAgentOpen(false);
  };

  const openJobDetails = (job: Job) => {
    setActiveJobDetails(job);
    setIsProposalFormOpen(false);
    setProposalStatus(null);
  };

  const openNodeDetails = (agent: Agent) => {
    setActiveNodeDetails(agent);
  };

  const handleSubmitProposal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitProposalOnchain();
  };

  const submitProposalOnchain = async () => {
    if (!activeJobDetails) return;
    const agentName = proposalForm.agentName.trim();
    const summary = proposalForm.summary.trim();
    const timeline = proposalForm.timeline.trim();
    const validator = proposalForm.validator.trim();
    setProposalStatus(null);
    if (!agentName || !summary || !timeline || !validator) {
      setProposalStatus("Fill in agent, proposal, timeline, and validator wallet before submitting.");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(validator)) {
      setProposalStatus("Validator wallet must be a full 0x address.");
      return;
    }
    if (walletAddress && validator.toLowerCase() === walletAddress.toLowerCase()) {
      setProposalStatus("Validator wallet must be different from the proposing wallet.");
      return;
    }

    setIsSubmittingProposal(true);
    setProposalStatus("Preparing transaction. Your wallet should ask you to sign if this job is funded and assignable.");
    setChainStatus("Confirm job acceptance in your wallet.");
    let receipt;
    try {
      receipt = await acceptJobOnchain(activeJobDetails.id, validator);
    } catch (error) {
      const message = errorMessage(error);
      setProposalStatus(`${message} If no wallet popup appeared, this job is probably not an onchain funded job or is not in the FUNDED state.`);
      setChainStatus(message);
      setIsSubmittingProposal(false);
      return;
    }

    const newProposal: Proposal = {
      id: `PRP-${Date.now().toString(36).toUpperCase()}`,
      jobId: activeJobDetails.id,
      agentName,
      summary,
      timeline,
      submittedAt: "just now",
    };
    const nextProposals = [newProposal, ...proposals];
    setProposals(nextProposals);
    saveLocalProposals(nextProposals);
    setProposalForm({ agentName: "", summary: "", timeline: "", validator: "" });
    setProposalStatus(`Proposal submitted onchain: ${shortHash(receipt.hash)}`);
    setChainStatus(`Proposal accepted onchain: ${shortHash(receipt.hash)}`);
    setChainStatusTx(receipt.hash);
    setIsSubmittingProposal(false);
    setIsProposalFormOpen(false);
  };

  const navButtonClass = (view: string) =>
    `px-3 py-1.5 rounded-md transition-colors ${
      activeView === view ? "text-white bg-white/5" : "hover:text-white hover:bg-white/5"
    }`;

  const visibleJobs = demoMode ? mergeJobs(localBounties, jobs.length ? jobs : MOCK_JOBS) : mergeJobs(localBounties, jobs);
  const visibleAgents = demoMode ? mergeAgents(localAgents, agents.length ? agents : MOCK_AGENTS) : mergeAgents(localAgents, agents);
  const visibleStats = demoMode && jobs.length === 0 && agents.length === 0 ? PLATFORM_STATS : stats;
  const visibleActivity = demoMode && activity.length === 0 ? MOCK_ACTIVITY : activity;
  const openJobsCount = visibleJobs.filter((job) => job.status.toLowerCase() === "open").length;
  const activeAgentsCount = visibleAgents.filter((agent) => agent.status.toLowerCase() === "active").length;
  const connectedNetworkLabel = walletAddress ? "Arc Testnet ready" : "Wallet disconnected";
  const activeJobProposals = activeJobDetails
    ? proposals.filter((proposal) => proposal.jobId === activeJobDetails.id)
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground grid-bg relative overflow-hidden font-sans">
      <Sheet open={isPostBountyOpen} onOpenChange={setIsPostBountyOpen}>
        <SheetContent className="w-full max-w-md border-border/50 bg-card text-white">
          <SheetHeader className="border-b border-border/40">
            <SheetTitle className="text-white">Post Bounty</SheetTitle>
            <SheetDescription>
              Create a marketplace bounty draft and surface it in Open Jobs.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handlePostBounty} className="flex flex-1 flex-col">
            <div className="space-y-5 p-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Title</span>
                <input
                  value={bountyForm.title}
                  onChange={(event) => setBountyForm((form) => ({ ...form, title: event.target.value }))}
                  placeholder="Build validator audit agent"
                  required
                  className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Bounty</span>
                <input
                  value={bountyForm.bounty}
                  onChange={(event) => setBountyForm((form) => ({ ...form, bounty: event.target.value }))}
                  placeholder="2500 USDC"
                  required
                  className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Description</span>
                <textarea
                  value={bountyForm.description}
                  onChange={(event) => setBountyForm((form) => ({ ...form, description: event.target.value }))}
                  placeholder="Explain the expected deliverable, validation criteria, and acceptance conditions."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Tags</span>
                <input
                  value={bountyForm.tags}
                  onChange={(event) => setBountyForm((form) => ({ ...form, tags: event.target.value }))}
                  placeholder="Solidity, Validation, Arc"
                  className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Required Skills</span>
                <input
                  value={bountyForm.skills}
                  onChange={(event) => setBountyForm((form) => ({ ...form, skills: event.target.value }))}
                  placeholder="Python, ERC-20, circuit simulation"
                  className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Deadline</span>
                <input
                  value={bountyForm.deadlineDays}
                  onChange={(event) => setBountyForm((form) => ({ ...form, deadlineDays: event.target.value }))}
                  type="number"
                  min="1"
                  required
                  className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                Publishing creates the job, asks for USDC approval, then funds escrow onchain.
              </div>
              {!walletAddress && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                  Connect a wallet to attach your address as the client.
                </div>
              )}
            </div>
            <SheetFooter className="border-t border-border/40">
              <Button type="submit" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Publish Bounty
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPostBountyOpen(false)}
                className="rounded-full bg-transparent border-border/50 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={isDeployAgentOpen} onOpenChange={setIsDeployAgentOpen}>
        <SheetContent className="w-full max-w-md border-border/50 bg-card text-white">
          <SheetHeader className="border-b border-border/40">
            <SheetTitle className="text-white">Deploy Agent</SheetTitle>
            <SheetDescription>
              Register an agent profile and add it to Top Agents.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleDeployAgent} className="flex flex-1 flex-col">
            <div className="space-y-5 p-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Agent Name</span>
                <input
                  value={agentForm.name}
                  onChange={(event) => setAgentForm((form) => ({ ...form, name: event.target.value }))}
                  placeholder="AuditRunner Alpha"
                  required
                  className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Specialty</span>
                <input
                  value={agentForm.specialty}
                  onChange={(event) => setAgentForm((form) => ({ ...form, specialty: event.target.value }))}
                  placeholder="Smart Contract Auditing"
                  required
                  className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Description</span>
                <textarea
                  value={agentForm.description}
                  onChange={(event) => setAgentForm((form) => ({ ...form, description: event.target.value }))}
                  placeholder="Describe what this agent can do and how it should be evaluated."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Capabilities / Skills</span>
                <input
                  value={agentForm.skills}
                  onChange={(event) => setAgentForm((form) => ({ ...form, skills: event.target.value }))}
                  placeholder="Solidity auditing, PCB review, market reasoning"
                  className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted-foreground">Status</span>
                <select
                  value={agentForm.status}
                  onChange={(event) => setAgentForm((form) => ({ ...form, status: event.target.value }))}
                  className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                >
                  <option className="bg-card" value="Active">Active</option>
                  <option className="bg-card" value="Training">Training</option>
                </select>
              </label>
              {!walletAddress && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                  Connect a wallet when you want this profile tied to an onchain owner.
                </div>
              )}
              <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                Deploying registers this agent profile with the onchain identity registry.
              </div>
            </div>
            <SheetFooter className="border-t border-border/40">
              <Button type="submit" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Terminal className="w-4 h-4 mr-2" /> Deploy Agent
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeployAgentOpen(false)}
                className="rounded-full bg-transparent border-border/50 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(activeDoc)} onOpenChange={(open) => !open && setActiveDoc(null)}>
        <SheetContent className="w-full max-w-3xl overflow-hidden border-border/50 bg-card text-white sm:max-w-3xl">
          <SheetHeader className="shrink-0 border-b border-border/40 bg-background/30">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <SheetTitle className="text-2xl text-white">{activeDoc?.title}</SheetTitle>
            <SheetDescription className="max-w-xl">{activeDoc?.body}</SheetDescription>
          </SheetHeader>
          <div className="grid shrink-0 grid-cols-3 gap-3 border-b border-border/40 p-4">
            <div className="rounded-lg border border-border/40 bg-background/50 p-3">
              <div className="text-xs uppercase text-muted-foreground">Sections</div>
              <div className="mt-1 font-mono text-lg text-white">
                {activeDoc?.content.split(/\r?\n/).filter((line) => line.startsWith("## ")).length ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/50 p-3">
              <div className="text-xs uppercase text-muted-foreground">Bullets</div>
              <div className="mt-1 font-mono text-lg text-white">
                {activeDoc?.content.split(/\r?\n/).filter((line) => line.trim().startsWith("- ")).length ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/50 p-3">
              <div className="text-xs uppercase text-muted-foreground">Mode</div>
              <div className="mt-1 font-mono text-lg text-primary">local</div>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 overflow-hidden">
            <article className="p-5 pb-10">
              <div className="rounded-xl border border-border/40 bg-background/50 p-6 shadow-inner">
                {activeDoc && <MarkdownReader content={activeDoc.content} />}
              </div>
            </article>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <JobDetailSheet
        job={activeJobDetails}
        open={Boolean(activeJobDetails)}
        onClose={() => { setActiveJobDetails(null); setIsProposalFormOpen(false); }}
        walletAddress={walletAddress}
        activity={activity}
        onAcceptJob={async (jobId) => {
          setChainStatus("Confirm job acceptance in your wallet.");
          try {
            const receipt = await acceptJobOnchain(jobId, walletAddress ?? "0x0000000000000000000000000000000000000000");
            setChainStatus(`Job accepted onchain: ${receipt.hash.slice(0,10)}...`);
            setChainStatusTx(receipt.hash);
          } catch (e: unknown) {
            setChainStatus(e instanceof Error ? e.message : "Transaction failed");
          }
        }}
        onSubmitProposal={(job) => { setActiveJobDetails(job); setIsProposalFormOpen(true); }}
      />

      {/* Keep old sheet hidden but functional for proposal form - replace with new agent sheet */}
      <Sheet
        open={false}
        onOpenChange={(open) => {
          if (!open) {
            setActiveJobDetails(null);
            setIsProposalFormOpen(false);
            setProposalStatus(null);
          }
        }}
      >
        <SheetContent className="w-full max-w-xl overflow-hidden border-border/50 bg-card text-white sm:max-w-xl">
          <SheetHeader className="shrink-0 border-b border-border/40">
            <SheetTitle className="text-white">{activeJobDetails?.title}</SheetTitle>
            <SheetDescription>
              {activeJobDetails?.id} · {activeJobDetails?.status} · {activeJobDetails?.timePosted}
            </SheetDescription>
          </SheetHeader>
          {activeJobDetails && (
            <ScrollArea className="min-h-0 flex-1 overflow-hidden">
            <div className="space-y-5 p-4 pb-10">
              {isProposalFormOpen && (
                <form noValidate onSubmit={handleSubmitProposal} className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="mb-4 rounded-lg border border-border/40 bg-background/50 p-3">
                    <div className="text-xs uppercase text-muted-foreground mb-1">Proposal For</div>
                    <div className="font-medium text-white">{activeJobDetails.title}</div>
                    <div className="mt-1 font-mono text-sm text-primary">{activeJobDetails.bounty}</div>
                  </div>
                  {proposalStatus && (
                    <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                      {proposalStatus}
                    </div>
                  )}
                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-muted-foreground">Agent</span>
                      <input
                        value={proposalForm.agentName}
                        onChange={(event) => setProposalForm((form) => ({ ...form, agentName: event.target.value }))}
                        placeholder={visibleAgents[0]?.name ?? "Your agent"}
                        required
                        className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-muted-foreground">Proposal</span>
                      <textarea
                        value={proposalForm.summary}
                        onChange={(event) => setProposalForm((form) => ({ ...form, summary: event.target.value }))}
                        placeholder="Describe how the agent will complete this bounty."
                        required
                        rows={4}
                        className="w-full resize-none rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-muted-foreground">Timeline</span>
                      <input
                        value={proposalForm.timeline}
                        onChange={(event) => setProposalForm((form) => ({ ...form, timeline: event.target.value }))}
                        placeholder="24 hours"
                        required
                        className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-muted-foreground">Validator Wallet</span>
                      <input
                        value={proposalForm.validator}
                        onChange={(event) => setProposalForm((form) => ({ ...form, validator: event.target.value }))}
                        placeholder="0x..."
                        required
                        className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
                      />
                    </label>
                    <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                      Submitting calls the job contract to accept this funded job with the validator wallet.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        disabled={isSubmittingProposal}
                        className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {isSubmittingProposal ? "Submitting..." : "Submit"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsProposalFormOpen(false)}
                        className="rounded-full bg-transparent border-border/50 text-white hover:bg-white/5"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </form>
              )}
              <div className="rounded-lg border border-border/40 bg-background/50 p-4">
                <div className="text-xs uppercase text-muted-foreground mb-1">Escrow</div>
                <div className="text-2xl font-mono text-primary glow-text">{activeJobDetails.bounty}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/40 bg-background/50 p-4">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Client</div>
                  <div className="font-mono text-sm text-white">{activeJobDetails.client}</div>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/50 p-4">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Agent Match</div>
                  <div className="flex items-center gap-3">
                    <Progress value={activeJobDetails.matchScore} className="flex-1" />
                    <span className="font-mono text-sm text-primary">{activeJobDetails.matchScore}%</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {activeJobDetails.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="border-border/50 text-muted-foreground bg-transparent">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/50 p-4">
                <div className="text-xs uppercase text-muted-foreground mb-2">Lifecycle</div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white">Escrow funded</span>
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Agent selected</span>
                    <span className="font-mono text-xs text-muted-foreground">pending</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Validation and release</span>
                    <span className="font-mono text-xs text-muted-foreground">pending</span>
                  </div>
                </div>
              </div>
              {activeJobProposals.length > 0 && (
                <div className="rounded-lg border border-border/40 bg-background/50 p-4">
                  <div className="text-xs uppercase text-muted-foreground mb-3">Submitted Proposals</div>
                  <div className="space-y-3">
                    {activeJobProposals.map((proposal) => (
                      <div key={proposal.id} className="rounded-md border border-border/30 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="font-medium text-white">{proposal.agentName}</span>
                          <span className="font-mono text-xs text-muted-foreground">{proposal.submittedAt}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{proposal.summary}</p>
                        <div className="mt-2 text-xs font-mono text-primary">{proposal.timeline}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <SheetFooter className="px-0">
                <Button
                  type="button"
                  onClick={() => setIsProposalFormOpen(true)}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Terminal className="w-4 h-4 mr-2" /> Submit Proposal
                </Button>
              </SheetFooter>
            </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <AgentProfileSheet
        agent={activeNodeDetails}
        open={Boolean(activeNodeDetails)}
        onClose={() => setActiveNodeDetails(null)}
        activity={activity}
        onFindJobs={() => { setActiveNodeDetails(null); setActiveView("marketplace"); setActiveTab("jobs"); }}
      />

      {/* Legacy agent sheet kept hidden */}
      <Sheet open={Boolean(activeNodeDetails) && false} onOpenChange={(open) => !open && setActiveNodeDetails(null)}>
        <SheetContent className="w-full max-w-xl border-border/50 bg-card text-white sm:max-w-xl">
          <SheetHeader className="border-b border-border/40">
            <SheetTitle className="text-white">{activeNodeDetails?.name}</SheetTitle>
            <SheetDescription>
              {activeNodeDetails?.id} · {activeNodeDetails?.status} · {activeNodeDetails?.specialty}
            </SheetDescription>
          </SheetHeader>
          {activeNodeDetails && (
            <div className="space-y-5 p-4">
              <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-background/50 p-4">
                <Avatar className="h-14 w-14 border border-border/50">
                  <AvatarImage src={activeNodeDetails.avatarUrl} />
                  <AvatarFallback className="bg-primary/20 text-primary font-mono text-xs">
                    {activeNodeDetails.id.slice(-3)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-semibold text-white">{activeNodeDetails.name}</h2>
                    <Badge variant="outline" className="border-primary/30 text-primary">{activeNodeDetails.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{activeNodeDetails.specialty}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/40 bg-background/50 p-4">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Reputation</div>
                  <div className="flex items-center gap-3">
                    <Progress value={Math.min(100, Math.round(activeNodeDetails.reputation * 20))} className="flex-1" />
                    <span className="font-mono text-sm text-primary">{activeNodeDetails.reputation}/5.0</span>
                  </div>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/50 p-4">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Total Earned</div>
                  <div className="font-mono text-lg text-white">{activeNodeDetails.earnings}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/40 bg-background/50 p-4">
                <div className="text-xs uppercase text-muted-foreground mb-3">Node Health</div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white">Registry profile</span>
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white">Execution endpoint</span>
                    <span className="font-mono text-xs text-primary">online</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current assignment</span>
                    <span className="font-mono text-xs text-muted-foreground">standby</span>
                  </div>
                </div>
              </div>

              <SheetFooter className="px-0">
                <Button
                  type="button"
                  onClick={() => {
                    setActiveNodeDetails(null);
                    setActiveView("marketplace");
                    setActiveTab("agents");
                  }}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <ServerCog className="w-4 h-4 mr-2" /> View Agent
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setActiveNodeDetails(null);
                    setActiveView("marketplace");
                    setActiveTab("jobs");
                  }}
                  className="rounded-full bg-transparent border-border/50 text-white hover:bg-white/5"
                >
                  <Activity className="w-4 h-4 mr-2" /> Find Jobs
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      {/* Navigation */}
      <nav className="glass-panel sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-primary">
              <Zap className="w-5 h-5 fill-primary" />
              <span className="font-heading font-semibold text-lg tracking-wide text-white">AgentWork</span>
            </div>
            <div className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground ml-8">
              <button type="button" onClick={() => setActiveView("dashboard")} className={navButtonClass("dashboard")}>Dashboard</button>
              <button type="button" onClick={() => setActiveView("marketplace")} className={navButtonClass("marketplace")}>Marketplace</button>
              <button type="button" onClick={() => setActiveView("nodes")} className={navButtonClass("nodes")}>Nodes</button>
              <button type="button" onClick={() => setActiveView("docs")} className={navButtonClass("docs")}>Docs</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Find jobs or agents..."
                className="bg-card/50 border border-border/50 rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 text-white w-64 transition-all focus:bg-card"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDemoMode((enabled) => !enabled)}
              className={`hidden rounded-full border-border/50 bg-transparent hover:bg-white/5 sm:inline-flex ${demoMode ? "text-primary" : "text-muted-foreground hover:text-white"}`}
            >
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Demo
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleConnectWallet}
              title={walletError ?? undefined}
              disabled={isConnectingWallet}
              className="rounded-full border-border/50 bg-transparent hover:bg-white/5 text-muted-foreground hover:text-white"
            >
              {isConnectingWallet ? "Connecting..." : walletAddress ? shortAddress(walletAddress) : "Connect Wallet"}
            </Button>
            {walletAddress && walletUsdcBalance && (
              <span className="hidden rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 font-mono text-xs text-primary lg:inline-flex">
                {walletUsdcBalance}
              </span>
            )}
            {walletError && (
              <span className="hidden lg:inline max-w-52 truncate text-xs text-amber-300" title={walletError}>
                {walletError}
              </span>
            )}
            <Avatar className="h-8 w-8 ring-1 ring-border/50 cursor-pointer hover:ring-primary/50 transition-colors">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>AX</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {chainStatus && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            <span>{chainStatus}</span>
            <div className="flex items-center gap-3">
              {chainStatusTx && (
                <a href={explorerTxUrl(chainStatusTx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-white hover:text-primary">
                  View tx <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button type="button" onClick={() => { setChainStatus(null); setChainStatusTx(null); }} className="text-primary/70 hover:text-primary">
              Dismiss
              </button>
            </div>
          </div>
        )}
        {demoMode && (
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <span><strong>Demo Mode</strong> - sample jobs and agents are enabled. Connect a wallet to interact with Arc Testnet.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setDemoMode(false)} className="rounded-full bg-transparent border-amber-300/40 text-amber-100 hover:bg-amber-400/10">
              Use live only
            </Button>
          </div>
        )}
        {activeView === "dashboard" && (
          <motion.section
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-4">
                  <Activity className="w-3 h-3" />
                  {isLive ? "Arc Network: live indexed" : "Arc Network: local fallback"}
                </div>
                <h1 className="text-4xl md:text-5xl font-heading font-medium tracking-tight mb-2 text-white">
                  Protocol dashboard
                </h1>
                <p className="text-muted-foreground max-w-xl text-lg">
                  Monitor escrow, agent capacity, wallet readiness, and settlement activity from one operational surface.
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setActiveView("marketplace")} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 glow-box">
                  <Plus className="w-4 h-4 mr-2" /> Open Marketplace
                </Button>
                <Button variant="outline" onClick={handleConnectWallet} className="rounded-full bg-card/30 border-border/50 hover:bg-white/5 text-white">
                  <Wallet className="w-4 h-4 mr-2" /> {walletAddress ? shortAddress(walletAddress) : "Connect Wallet"}
                </Button>
              </div>
            </div>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {visibleStats.map((stat, idx) => (
                <Card key={stat.label} className="bg-card/40 border-border/40 backdrop-blur-md">
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-muted-foreground mb-2 flex justify-between items-center">
                      {stat.label}
                      {idx === 0 && <Layers className="w-4 h-4 opacity-50" />}
                      {idx === 1 && <Cpu className="w-4 h-4 opacity-50" />}
                      {idx === 2 && <Zap className="w-4 h-4 opacity-50" />}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-3xl font-mono text-white">{stat.value}</h2>
                      <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center">
                        <TrendingUp className="w-3 h-3 mr-1" /> {stat.change}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-card/40 border-border/40 lg:col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-heading text-white">Settlement Queue</h2>
                    <Badge className="bg-primary/10 text-primary border-primary/20">{openJobsCount} open</Badge>
                  </div>
                  <div className="space-y-3">
                    {visibleJobs.slice(0, 3).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          setActiveView("marketplace");
                          setActiveTab("jobs");
                        }}
                        className="w-full text-left rounded-lg border border-border/40 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs text-muted-foreground">{job.id}</span>
                              <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">{job.status}</Badge>
                            </div>
                            <h3 className="font-medium text-white">{job.title}</h3>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="font-mono text-primary">{job.bounty}</div>
                            <div className="text-xs text-muted-foreground">{job.timePosted}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border/40">
                <CardContent className="p-6">
                  <h2 className="text-xl font-heading text-white mb-5">System Status</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Data mode</span>
                      </div>
                      <span className="text-sm text-white">{isLive ? "Live API" : "Fallback"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Wallet className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Wallet</span>
                      </div>
                      <span className="text-sm text-white">{connectedNetworkLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Active agents</span>
                      </div>
                      <span className="text-sm text-white">{activeAgentsCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </motion.section>
        )}

        {activeView === "marketplace" && (
          <>
            {/* Header Section */}
            <section className="mb-12">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-6"
              >
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-4">
                    <Activity className="w-3 h-3" />
                    {isLive ? "Arc Network: live indexed" : "Arc Network: local fallback"}
                  </div>
                  <h1 className="text-4xl md:text-5xl font-heading font-medium tracking-tight mb-2 text-white">
                    Intelligence <span className="text-muted-foreground italic">at scale.</span>
                  </h1>
                  <p className="text-muted-foreground max-w-xl text-lg">
                    The premier decentralized marketplace for autonomous agents. Deploy code, earn USDC, and build immutable on-chain reputation.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={() => setIsPostBountyOpen(true)}
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 glow-box"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Post Bounty
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDeployAgentOpen(true)}
                    className="rounded-full bg-card/30 border-border/50 hover:bg-white/5 text-white"
                  >
                    <Terminal className="w-4 h-4 mr-2" /> Deploy Agent
                  </Button>
                </div>
              </motion.div>
            </section>

            {/* Stats Row */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {visibleStats.map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                >
                  <Card className="bg-card/40 border-border/40 backdrop-blur-md overflow-hidden relative group transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <CardContent className="p-6">
                      <p className="text-sm font-medium text-muted-foreground mb-2 flex justify-between items-center">
                        {stat.label}
                        {idx === 0 && <Layers className="w-4 h-4 opacity-50" />}
                        {idx === 1 && <Cpu className="w-4 h-4 opacity-50" />}
                        {idx === 2 && <Zap className="w-4 h-4 opacity-50" />}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-3xl font-mono text-white">{stat.value}</h2>
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" /> {stat.change}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </section>

            {/* Main Interface Tabs */}
            <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-6">
            <TabsList className="bg-card/50 border border-border/50">
              <TabsTrigger value="jobs" className="rounded-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Open Jobs</TabsTrigger>
              <TabsTrigger value="agents" className="rounded-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Top Agents</TabsTrigger>
              <TabsTrigger value="activity" className="rounded-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Live Activity</TabsTrigger>
            </TabsList>
            
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="w-4 h-4" />
              <span>Arc Network</span>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse ml-1" />
            </div>
          </div>

          <ScrollArea className="h-[500px] rounded-xl border border-border/40 bg-card/20 backdrop-blur-sm p-4">
            <AnimatePresence mode="popLayout">
              {/* JOBS TAB */}
              {activeTab === "jobs" && (
                <TabsContent value="jobs" className="m-0 mt-0" forceMount>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col gap-3"
                  >
                    {isLoading && !demoMode && (
                      <div className="flex flex-col gap-3">
                        <JobCardSkeleton />
                        <JobCardSkeleton />
                        <JobCardSkeleton />
                      </div>
                    )}
                    {visibleJobs.length === 0 && !isLoading && (
                      <div className="rounded-lg border border-dashed border-border/50 bg-white/[0.03] p-8 text-center">
                        <Layers className="mx-auto mb-3 h-8 w-8 text-primary/50" />
                        <h3 className="mb-2 text-lg font-medium text-white">No onchain jobs yet</h3>
                        <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
                          Create the first Arc-funded task, or enable Demo Mode to rehearse the full presentation flow.
                        </p>
                        <div className="flex justify-center gap-2">
                          <Button type="button" onClick={() => setIsPostBountyOpen(true)} className="rounded-full bg-primary text-primary-foreground">
                            <Plus className="mr-2 h-4 w-4" /> Post Bounty
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setDemoMode(true)} className="rounded-full bg-transparent border-border/50 text-white">
                            <PlayCircle className="mr-2 h-4 w-4" /> Demo Mode
                          </Button>
                        </div>
                      </div>
                    )}
                    {visibleJobs.map((job) => (
                      <motion.div
                        key={job.id}
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openJobDetails(job)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openJobDetails(job);
                            }
                          }}
                          className="group bg-card/40 border border-border/40 rounded-lg p-5 hover:bg-card/80 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded">{job.id}</span>
                                <Badge className="bg-primary/10 text-primary border-primary/20 font-normal hover:bg-primary/20">
                                  {job.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{job.timePosted}</span>
                              </div>
                              <h3 className="text-lg font-medium text-white mb-1 group-hover:text-primary transition-colors">{job.title}</h3>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Client:</span>
                                <span className="text-sm font-mono text-white/80">{job.client}</span>
                                {job.client.startsWith("0x") && <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                              </div>
                            </div>
                            
                            <div className="flex flex-col md:items-end gap-3 md:w-48">
                              <div className="text-right">
                                <div className="text-xl font-mono text-white glow-text">{job.bounty}</div>
                                <div className="text-xs text-muted-foreground mt-1">Escrow Locked</div>
                              </div>
                              
                              <div className="w-full">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">Agent Match</span>
                                  <span className="text-primary">{job.matchScore}%</span>
                                </div>
                                <Progress value={job.matchScore} className="w-full" />
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                            <div className="flex gap-2">
                              {job.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs font-normal border-border/50 text-muted-foreground bg-transparent">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                openJobDetails(job);
                              }}
                              className="hidden group-hover:flex text-white hover:bg-white/10 hover:text-primary"
                            >
                              View details <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </TabsContent>
              )}

              {/* AGENTS TAB */}
              {activeTab === "agents" && (
                <TabsContent value="agents" className="m-0 mt-0" forceMount>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
                    {isLoading && !demoMode && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AgentCardSkeleton />
                        <AgentCardSkeleton />
                        <AgentCardSkeleton />
                      </div>
                    )}
                    {visibleAgents.length === 0 && !isLoading && (
                      <div className="col-span-full rounded-lg border border-dashed border-border/50 bg-white/[0.03] p-8 text-center">
                        <Cpu className="mx-auto mb-3 h-8 w-8 text-primary/50" />
                        <h3 className="mb-2 text-lg font-medium text-white">No registered agents yet</h3>
                        <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
                          Register an agent identity on Arc or enable Demo Mode to show the agent reputation surface.
                        </p>
                        <div className="flex justify-center gap-2">
                          <Button type="button" onClick={() => setIsDeployAgentOpen(true)} className="rounded-full bg-primary text-primary-foreground">
                            <Terminal className="mr-2 h-4 w-4" /> Deploy Agent
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setDemoMode(true)} className="rounded-full bg-transparent border-border/50 text-white">
                            <PlayCircle className="mr-2 h-4 w-4" /> Demo Mode
                          </Button>
                        </div>
                      </div>
                    )}
                    {visibleAgents.map((agent, idx) => (
                      <motion.div
                        key={agent.id}
                        whileHover={{ y: -5 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="bg-card/40 border-border/40 hover:border-primary/50 transition-colors cursor-pointer group h-full">
                          <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <Avatar className="h-12 w-12 border border-border/50">
                              <AvatarImage src={agent.avatarUrl} />
                              <AvatarFallback className="bg-primary/20 text-primary font-mono text-xs">{agent.id.slice(-3)}</AvatarFallback>
                            </Avatar>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-white">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-card border-border/50 text-white">
                                <DropdownMenuItem onClick={() => openNodeDetails(agent)}>View Profile</DropdownMenuItem>
                                <DropdownMenuItem>Hire Agent</DropdownMenuItem>
                                <DropdownMenuItem>Audit Logs</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg text-white group-hover:text-primary transition-colors">{agent.name}</h3>
                              <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${agent.status === 'Active' ? 'text-primary border-primary/30' : 'text-amber-400 border-amber-400/30'}`}>
                                {agent.status}
                              </Badge>
                            </div>
                            <p className="text-sm font-mono text-muted-foreground">{agent.id}</p>
                          </div>

                          <div className="space-y-3 mb-6">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Specialty</div>
                              <div className="text-sm text-white/90">{agent.specialty}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">Reputation</div>
                                <div className="text-sm font-mono text-white flex items-center">
                                  {agent.reputation} <span className="text-primary ml-1 text-xs">/5.0</span>
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">Total Earned</div>
                                <div className="text-sm font-mono text-white glow-text">{agent.earnings}</div>
                              </div>
                            </div>
                          </div>

                          <Button type="button" onClick={() => openNodeDetails(agent)} className="w-full bg-white/5 hover:bg-white/10 text-white border border-border/50 group-hover:border-primary/30 transition-all">
                            View Contracts
                          </Button>
                        </CardContent>
                      </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                </TabsContent>
              )}

              {/* ACTIVITY TAB */}
              {activeTab === "activity" && (
                <TabsContent value="activity" className="m-0 mt-0" forceMount>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    {isLoading && !demoMode && (
                      <div className="space-y-3">
                        <ActivityItemSkeleton />
                        <ActivityItemSkeleton />
                        <ActivityItemSkeleton />
                      </div>
                    )}
                    {visibleActivity.length === 0 && !isLoading && (
                      <div className="rounded-lg border border-dashed border-border/50 bg-white/[0.03] p-10 text-center">
                        <Activity className="w-10 h-10 text-primary/30 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">No Arc events indexed yet</h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                          Once jobs are created, funded, assigned, submitted, validated, or settled, they will appear here with explorer links.
                        </p>
                      </div>
                    )}
                    {visibleActivity.map((event) => (
                      <div key={event.id} className="rounded-lg border border-border/40 bg-card/40 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <Badge className="bg-primary/10 text-primary border-primary/20">{event.type}</Badge>
                              {event.jobId && <span className="font-mono text-xs text-muted-foreground">{event.jobId}</span>}
                              <span className="font-mono text-xs text-muted-foreground">block {event.blockNumber}</span>
                            </div>
                            <p className="text-sm text-white">{event.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{relativeEventTime(event.timestamp)}</p>
                          </div>
                          <a href={explorerTxUrl(event.txHash)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/50 px-3 py-1.5 text-xs text-white hover:border-primary/40 hover:text-primary">
                            {shortHash(event.txHash)} <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </TabsContent>
              )}
            </AnimatePresence>
          </ScrollArea>
            </Tabs>
          </>
        )}

        {activeView === "nodes" && (
          <motion.section
            key="nodes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-4xl md:text-5xl font-heading font-medium tracking-tight mb-2 text-white">Node Operations</h1>
              <p className="text-muted-foreground max-w-xl text-lg">Validator and worker node readiness across the AgentWork execution layer.</p>
            </div>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {visibleAgents.map((agent) => (
                <Card
                  key={agent.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openNodeDetails(agent)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openNodeDetails(agent);
                    }
                  }}
                  className="bg-card/40 border-border/40 cursor-pointer hover:border-primary/50 hover:bg-card/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <ServerCog className="w-5 h-5 text-primary" />
                      <Badge variant="outline" className="border-primary/30 text-primary">{agent.status}</Badge>
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-1">{agent.name}</h2>
                    <p className="text-sm text-muted-foreground mb-4">{agent.specialty}</p>
                    <Progress value={Math.min(100, Math.round(agent.reputation * 20))} />
                  </CardContent>
                </Card>
              ))}
            </section>
          </motion.section>
        )}

        {activeView === "docs" && (
          <motion.section
            key="docs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-4xl md:text-5xl font-heading font-medium tracking-tight mb-2 text-white">Protocol Docs</h1>
              <p className="text-muted-foreground max-w-xl text-lg">Quick references for local development, API integration, and onchain settlement flows.</p>
            </div>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DOCS.map((doc) => (
                <Card key={doc.title} className="bg-card/40 border-border/40 hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <FileText className="w-5 h-5 text-primary mb-4" />
                    <h2 className="text-lg font-semibold text-white mb-2">{doc.title}</h2>
                    <p className="text-sm text-muted-foreground mb-5">{doc.body}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveDoc(doc)}
                      className="rounded-full bg-transparent border-border/50 text-white hover:bg-white/5"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" /> Open Docs
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </section>
          </motion.section>
        )}
      </main>
    </div>
  );
}
