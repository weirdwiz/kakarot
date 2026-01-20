
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-700/50 rounded ${className}`}
    />
  );
}

export function MeetingCardSkeleton() {
  return (
    <div className="p-4 border-b border-[#1A1A1A]">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/4" />
          <div className="flex items-center gap-1 mt-2">
            <Skeleton className="h-3 w-3" />
            <div className="flex -space-x-1">
              <Skeleton className="w-5 h-5 rounded-full" />
              <Skeleton className="w-5 h-5 rounded-full" />
              <Skeleton className="w-5 h-5 rounded-full" />
            </div>
          </div>
        </div>
        <Skeleton className="w-4 h-4" />
      </div>
    </div>
  );
}

export function PersonCardSkeleton() {
  return (
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full bg-gray-300" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-2/3 bg-gray-300" />
          <Skeleton className="h-3 w-1/2 bg-gray-300" />
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <Skeleton className="h-3 w-20 bg-gray-300" />
        <Skeleton className="h-3 w-16 bg-gray-300" />
      </div>
    </div>
  );
}

export function MeetingListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <MeetingCardSkeleton key={i} />
      ))}
    </>
  );
}

export function PersonListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PersonCardSkeleton key={i} />
      ))}
    </>
  );
}
