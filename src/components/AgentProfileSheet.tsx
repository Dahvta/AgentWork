import { motion } from "motion/react";
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Star,
  Briefcase,
  ShieldCheck,
  Activity,
  ServerCog,
  TrendingUp,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MarketplaceAgent, ActivityItem } from "../lib/types";
import { explorerTxUrl } from "../lib/protocol";

type Props = {
  agent: MarketplaceAgent | null;
  open: boolean;
  onClose: () => void;
  activity: ActivityItem[];
  onFindJobs: () => void;
};

function ReputationMeter({ score }: { score: number }) {
  const pct = Math.min(100, Math.round((score / 5) * 100));
  const circumference = 2 * Math.PI * 38;
  const dash = (pct / 100) * circumference;
  const color = score >= 4.5 ? "#00FF9D" : score >= 3.5 ? "#60a5fa" : "#f59e0b";

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg className="absolute inset-0 -rotate-90" width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r="38" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle
          cx="56"
          cy="56"
          r="38"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-mono font-bold" style={{ color }}>{score.toFixed(2)}</div>
        <div className="text-[10px] text-muted-foreground font-mono">/ 5.00</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent = false }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? "border-primary/20 bg-primary/5" : "border-border/40 bg-card/40"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-mono font-semibold ${accent ? "text-primary" : "text-white"}`}>{value}</div>
    </div>
  );
}

export function AgentProfileSheet({ agent, open, onClose, activity, onFindJobs }: Props) {
  if (!agent) return null;

  const agentActivity = activity.filter(
    (a) => a.description.toLowerCase().includes(agent.name.toLowerCase()) ||
           a.type === "AgentRegistered"
  ).slice(0, 6);

  const skills = agent.specialty ? agent.specialty.split(",").map((s) => s.trim()) : [agent.specialty];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full max-w-2xl border-border/50 bg-[#0a0a0f] text-white sm:max-w-2xl p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-card/40">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/20 shrink-0">
                <AvatarImage src={agent.avatarUrl} />
                <AvatarFallback className="bg-primary/20 text-primary font-mono text-sm">
                  {agent.id.slice(-3)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <SheetTitle className="text-white text-xl font-heading">{agent.name}</SheetTitle>
                  <Badge
                    variant="outline"
                    className={agent.status === "Active"
                      ? "border-primary/30 text-primary text-[10px]"
                      : "border-amber-400/30 text-amber-400 text-[10px]"
                    }
                  >
                    {agent.status}
                  </Badge>
                </div>
                <SheetDescription className="font-mono text-xs">{agent.id}</SheetDescription>
                <p className="text-sm text-muted-foreground mt-1">{agent.specialty}</p>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-5 space-y-6">

              {/* Reputation + Stats */}
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="rounded-xl border border-border/40 bg-card/40 p-5 flex flex-col items-center gap-3 shrink-0">
                  <div className="text-xs uppercase text-muted-foreground tracking-wider">Reputation Score</div>
                  <ReputationMeter score={agent.reputation} />
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${agent.reputation >= star ? "text-primary fill-primary" : "text-muted-foreground/20"}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 flex-1 w-full">
                  <StatCard label="Total Earned" value={agent.earnings} icon={TrendingUp} accent />
                  <StatCard label="Status" value={agent.status} icon={Activity} />
                  <StatCard label="Specialty" value={agent.specialty.split(",")[0]} icon={ShieldCheck} />
                  <StatCard label="Agent ID" value={agent.id} icon={ServerCog} />
                </div>
              </div>

              {/* Capabilities */}
              <div className="rounded-xl border border-border/40 bg-card/40 p-5">
                <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-primary" />
                  Capabilities & Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="border-primary/20 bg-primary/5 text-primary/80 text-xs">
                      {skill}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="border-border/40 text-muted-foreground text-xs">
                    USDC Settlement
                  </Badge>
                  <Badge variant="outline" className="border-border/40 text-muted-foreground text-xs">
                    Arc Testnet
                  </Badge>
                </div>
              </div>

              {/* Node Health */}
              <div className="rounded-xl border border-border/40 bg-card/40 p-5">
                <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">Node Health</h3>
                <div className="space-y-3">
                  {[
                    { label: "Registry profile", ok: true },
                    { label: "Execution endpoint", ok: true },
                    { label: "Reputation updated", ok: agent.reputation > 0 },
                    { label: "Current assignment", ok: false, pending: true },
                  ].map(({ label, ok, pending }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className={`text-sm ${ok ? "text-white" : "text-muted-foreground"}`}>{label}</span>
                      {pending ? (
                        <span className="font-mono text-xs text-muted-foreground">standby</span>
                      ) : ok ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground/40" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity History */}
              <div>
                <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  Recent Activity
                </h3>
                {agentActivity.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/40 bg-white/[0.02] p-6 text-center">
                    <Activity className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No indexed activity for this agent yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agentActivity.map((event, idx) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-start gap-3 rounded-lg border border-border/30 bg-card/30 p-3"
                      >
                        <div className="h-2 w-2 rounded-full bg-primary/60 shrink-0 mt-1.5" />
                        <div className="min-w-0 flex-1">
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] mb-1">
                            {event.type}
                          </Badge>
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

              {/* Actions */}
              <div className="flex gap-3 pb-2">
                <Button
                  type="button"
                  onClick={onFindJobs}
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Briefcase className="w-4 h-4 mr-2" /> Find Jobs for Agent
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="rounded-full border-border/50 bg-transparent text-white hover:bg-white/5"
                >
                  <Activity className="w-4 h-4 mr-2" /> Close
                </Button>
              </div>

            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
