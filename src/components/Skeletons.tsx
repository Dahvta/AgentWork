export function SkeletonPulse({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/[0.05] ${className}`}
      aria-hidden="true"
    />
  );
}

export function JobCardSkeleton() {
  return (
    <div className="bg-card/40 border border-border/40 rounded-lg p-5">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <SkeletonPulse className="h-5 w-20 rounded-full" />
            <SkeletonPulse className="h-5 w-16 rounded-full" />
            <SkeletonPulse className="h-4 w-12" />
          </div>
          <SkeletonPulse className="h-6 w-3/4" />
          <SkeletonPulse className="h-4 w-1/2" />
        </div>
        <div className="flex flex-col gap-3 md:w-48">
          <SkeletonPulse className="h-7 w-28 ml-auto" />
          <SkeletonPulse className="h-2 w-full rounded-full" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-border/20 flex gap-2">
        <SkeletonPulse className="h-5 w-16 rounded-full" />
        <SkeletonPulse className="h-5 w-14 rounded-full" />
        <SkeletonPulse className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="bg-card/40 border border-border/40 rounded-xl p-6 space-y-4">
      <div className="flex justify-between items-start">
        <SkeletonPulse className="h-12 w-12 rounded-full" />
        <SkeletonPulse className="h-7 w-7 rounded" />
      </div>
      <div className="space-y-2">
        <SkeletonPulse className="h-5 w-2/3" />
        <SkeletonPulse className="h-4 w-1/2" />
      </div>
      <div className="space-y-2">
        <SkeletonPulse className="h-4 w-full" />
        <div className="grid grid-cols-2 gap-2">
          <SkeletonPulse className="h-10 rounded-lg" />
          <SkeletonPulse className="h-10 rounded-lg" />
        </div>
      </div>
      <SkeletonPulse className="h-9 w-full rounded-lg" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-card/40 border border-border/40 rounded-xl p-6 space-y-3">
      <div className="flex justify-between items-center">
        <SkeletonPulse className="h-4 w-32" />
        <SkeletonPulse className="h-4 w-4" />
      </div>
      <SkeletonPulse className="h-9 w-24" />
      <SkeletonPulse className="h-4 w-16 rounded-full" />
    </div>
  );
}

export function ActivityItemSkeleton() {
  return (
    <div className="rounded-lg border border-border/30 bg-card/30 p-4 flex items-start gap-3">
      <SkeletonPulse className="h-2 w-2 rounded-full mt-1.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <SkeletonPulse className="h-5 w-24 rounded-full" />
          <SkeletonPulse className="h-5 w-20 rounded-full" />
        </div>
        <SkeletonPulse className="h-4 w-full" />
        <SkeletonPulse className="h-3 w-16" />
      </div>
      <SkeletonPulse className="h-8 w-28 rounded-full shrink-0" />
    </div>
  );
}
