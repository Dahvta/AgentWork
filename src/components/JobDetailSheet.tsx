import { useState } from "react";
import { motion } from "motion/react";
import {
  ExternalLink,
  CheckCircle2,
  Circle,
  Clock,
  ShieldCheck,
  Terminal,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Zap,
  User,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { explorerTxUrl } from "../lib/protocol";
import type { MarketplaceJob, ActivityItem } from "../lib/types";

const JOB_STATES = ["CREATED", "FUNDED", "ASSIGNED", "SUBMITTED", "VALIDATING", "COMPLETED"] as const;

function getStateIndex(status: string): number {
  const normalized = status.toUpperCase().replace(" ", "_").replace("IN_PROGRESS", "ASSIGNED");
  const idx = JOB_STATES.indexOf(normalized as typeof JOB_STATES[number]);
  return idx === -1 ? 1 : idx;
}

function getStateBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "open" || s === "funded") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (s === "in progress" || s === "assigned") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (s === "validating" || s === "submitted") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (s === "completed") return "bg-primary/10 text-primary border-primary/20";
  if (s === "disputed") return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-white/5 text-muted-foreground border-border/40";
}

type Props = {
  job: MarketplaceJob | null;
  open: boolean;
  onClose: () => void;
  walletAddress: string | null;
  activity: ActivityItem[];
  onAcceptJob: (jobId: string) => Promise<void>;
  onSubmitProposal: (job: MarketplaceJob) => void;
};

export function JobDetailSheet({ job, open, onClose, walletAddress, activity, onAcceptJob, onSubmitProposal }: Props) {
  const [accepting, setAccepting] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  if (!job) return null;

  const stateIndex = getStateIndex(job.status);
  const progressPct = Math.round((stateIndex / (JOB_STATES.length - 1)) * 100);
  const jobActivity = activity.filter((a) => a.jobId === job.id).slice(0, 10);

  async function handleAccept() {
    setAccepting(true);
    try {
      await onAcceptJob(job!.id);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full max-w-2xl border-border/50 bg-[#0a0a0f] text-white sm:max-w-2xl p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-card/40">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-border/30">
                    {job.id}
                  </span>
                  <Badge className={getStateBadgeClass(job.status)}>{job.status}</Badge>
                  <span className="text-xs text-muted-foreground">{job.timePosted}</span>
                </div>
                <SheetTitle className="text-white text-xl font-heading leading-tight">{job.title}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs">{job.client}</span>
                  {job.client.startsWith("0x") && <ShieldCheck className="w-3 h-3 text-primary" />}
                </SheetDescription>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-mono text-primary">{job.bounty}</div>
                <div className="text-xs text-muted-foreground">Escrow locked</div>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-6">

              {/* Lifecycle Progress */}
              <div className="rounded-xl border border-border/40 bg-card/40 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white uppercase tracking-wider">Job Lifecycle</h3>
                  <span className="font-mono text-xs text-primary">{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="mb-4 h-1.5" />
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {JOB_STATES.map((state, idx) => {
                    const done = idx < stateIndex;
                    const current = idx === stateIndex;
                    return (
                      <div key={state} className="flex items-center gap-1 shrink-0">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-mono transition-all ${
                          current
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : done
                            ? "text-primary/60"
                            : "text-muted-foreground/40"
                        }`}>
                          {done ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : current ? (
                            <Zap className="w-3 h-3" />
                          ) : (
                            <Circle className="w-3 h-3" />
                          )}
                          {state}
                        </div>
                        {idx < JOB_STATES.length - 1 && (
                          <ChevronRight className="w-3 h-3 text-border/50 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tags & Match */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/40 bg-card/40 p-4">
                  <div className="text-xs uppercase text-muted-foreground mb-2">Agent Match Score</div>
                  <div className="flex items-center gap-3">
                    <Progress value={job.matchScore} className="flex-1 h-1.5" />
                    <span className="font-mono text-sm text-primary">{job.matchScore}%</span>
                  </div>
                </div>
                <div className="rounded-lg border border-border/40 bg-card/40 p-4">
                  <div className="text-xs uppercase text-muted-foreground mb-2">Required Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {job.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] border-border/50 text-muted-foreground bg-transparent">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
                <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-3">Actions</h3>

                {!walletAddress ? (
                  <div className="flex items-center gap-2 text-sm text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    Connect your wallet to interact with this job
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={handleAccept}
                      disabled={accepting}
                      className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {accepting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                      ) : (
                        <><Terminal className="w-4 h-4 mr-2" /> Accept Job</>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onSubmitProposal(job)}
                      className="rounded-full border-border/50 bg-transparent text-white hover:bg-white/5"
                    >
                      <User className="w-4 h-4 mr-2" /> Submit Proposal
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDisputeOpen(!disputeOpen)}
                      className="rounded-full border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/5"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" /> Dispute
                    </Button>
                  </div>
                )}

                {/* Dispute form */}
                {disputeOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-3 border-t border-border/30 space-y-3"
                  >
                    <textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Describe the reason for this dispute..."
                      rows={3}
                      className="w-full resize-none rounded-lg border border-red-500/20 bg-background/60 px-3 py-2 text-sm text-white outline-none focus:border-red-500/40"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20"
                    >
                      Submit Dispute On-Chain
                    </Button>
                  </motion.div>
                )}
              </div>

              {/* On-chain Event History */}
              <div>
                <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  On-chain Event History
                </h3>
                {jobActivity.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/40 bg-white/[0.02] p-6 text-center">
                    <Clock className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No on-chain events indexed for this job yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobActivity.map((event, idx) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-start gap-3 rounded-lg border border-border/30 bg-card/30 p-3"
                      >
                        <div className="mt-0.5 h-2 w-2 rounded-full bg-primary/60 shrink-0 mt-1.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                              {event.type}
                            </Badge>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              block {event.blockNumber}
                            </span>
                          </div>
                          <p className="text-xs text-white/80">{event.description}</p>
                        </div>
                        <a
                          href={explorerTxUrl(event.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
