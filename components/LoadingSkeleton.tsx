'use client'

export function CardSkeleton() {
  return (
    <div className="rounded-card p-6 border border-border bg-card/70 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 bg-surface rounded w-24 mb-2"></div>
          <div className="h-8 bg-surface rounded w-16"></div>
        </div>
        <div className="w-10 h-10 bg-surface rounded-full"></div>
      </div>
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border animate-pulse">
      <div className="flex-1">
        <div className="h-4 bg-surface rounded w-32 mb-2"></div>
        <div className="h-3 bg-surface rounded w-48"></div>
      </div>
      <div className="h-6 bg-surface rounded w-20"></div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="rounded-card p-6 border border-border bg-card/70 animate-pulse">
      <div className="h-6 bg-surface rounded w-32 mb-6"></div>
      <div className="h-64 bg-surface rounded flex items-center justify-center">
        <svg className="w-12 h-12 text-text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        </svg>
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-border bg-card/70 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  )
}
