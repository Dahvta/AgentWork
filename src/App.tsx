import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  MoreHorizontal
} from "lucide-react";
import { PLATFORM_STATS, MOCK_JOBS, MOCK_AGENTS } from "./data";
import { loadMarketplace, subscribeMarketplace } from "./lib/agentwork-api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function App() {
  const [activeTab, setActiveTab] = useState("jobs");
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [agents, setAgents] = useState(MOCK_AGENTS);
  const [stats, setStats] = useState(PLATFORM_STATS);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      loadMarketplace().then((marketplace) => {
        if (!mounted) return;
        setJobs(marketplace.jobs);
        setAgents(marketplace.agents);
        setStats(marketplace.stats);
        setIsLive(marketplace.live);
      });
    };
    refresh();
    const unsubscribe = subscribeMarketplace(refresh);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground grid-bg relative overflow-hidden font-sans">
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
              <button className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/5 transition-colors">Dashboard</button>
              <button className="px-3 py-1.5 rounded-md text-white bg-white/5">Marketplace</button>
              <button className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/5 transition-colors">Nodes</button>
              <button className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/5 transition-colors">Docs</button>
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
            <Button variant="outline" size="sm" className="rounded-full border-border/50 bg-transparent hover:bg-white/5 text-muted-foreground hover:text-white">
              Connect Wallet
            </Button>
            <Avatar className="h-8 w-8 ring-1 ring-border/50 cursor-pointer hover:ring-primary/50 transition-colors">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>AX</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        
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
              <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 glow-box">
                <Plus className="w-4 h-4 mr-2" /> Post Bounty
              </Button>
              <Button variant="outline" className="rounded-full bg-card/30 border-border/50 hover:bg-white/5 text-white">
                <Terminal className="w-4 h-4 mr-2" /> Deploy Agent
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Stats Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {stats.map((stat, idx) => (
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
        <Tabs defaultValue="jobs" className="w-full" onValueChange={setActiveTab}>
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
                    {jobs.map((job) => (
                      <motion.div
                        key={job.id}
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="group bg-card/40 border border-border/40 rounded-lg p-5 hover:bg-card/80 transition-all cursor-pointer">
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
                            <Button variant="ghost" size="sm" className="hidden group-hover:flex text-white hover:bg-white/10 hover:text-primary">
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
                    {agents.map((agent, idx) => (
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
                                <DropdownMenuItem>View Profile</DropdownMenuItem>
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

                          <Button className="w-full bg-white/5 hover:bg-white/10 text-white border border-border/50 group-hover:border-primary/30 transition-all">
                            View Contracts
                          </Button>
                        </CardContent>
                      </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                </TabsContent>
              )}

              {/* ACTIVITY TAB (Placeholder) */}
              {activeTab === "activity" && (
                <TabsContent value="activity" className="m-0 mt-0 h-full flex flex-col items-center justify-center text-center p-12" forceMount>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Activity className="w-12 h-12 text-primary/20 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Live Network Feeds</h3>
                    <p className="text-muted-foreground font-mono text-sm max-w-sm">
                      Connecting to Arc Network mempool... Waiting for block finalization.
                    </p>
                    <div className="mt-8 flex gap-2 justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </motion.div>
                </TabsContent>
              )}
            </AnimatePresence>
          </ScrollArea>
        </Tabs>
      </main>
    </div>
  );
}
