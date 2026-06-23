'use client'

import React from 'react'

/**
 * Shared loading-skeleton library.
 *
 * Every dashboard route renders one of the full-page skeletons below — both
 * through the Next.js `loading.tsx` convention (shown instantly on navigation)
 * and from the page's own in-component loading state (shown while client-side
 * data is fetched). Reusing the same skeleton in both places keeps the loading
 * UI identical from the first paint until the real content arrives, which
 * removes the content jump/bounce that happens when a tiny spinner is swapped
 * for a full page.
 *
 * Skeletons mirror the real layout (header, toolbar, cards, charts, forms…) and
 * reserve a `min-height` so the surrounding container does not collapse and
 * shift while content loads.
 */

// ---------------------------------------------------------------------------
// Base primitive
// ---------------------------------------------------------------------------

/** A single pulsing placeholder block. Compose these to build any skeleton. */
export function Skeleton({ className = '' }: { className?: string }) {
  // Theme-aware tint so the placeholder is visible on both light and dark cards.
  return <div className={`animate-pulse rounded bg-black/10 dark:bg-white/10 ${className}`} />
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** Page title + subtitle, optionally with a primary action button on the side. */
export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {withAction && <Skeleton className="h-10 w-36 rounded-button" />}
    </div>
  )
}

/** Search box + filter/sort controls used on list pages. */
export function ToolbarSkeleton() {
  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <Skeleton className="h-9 w-full rounded-button lg:max-w-sm" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-16 rounded-button" />
        <Skeleton className="h-9 w-16 rounded-button" />
        <Skeleton className="h-9 w-16 rounded-button" />
        <Skeleton className="h-9 w-28 rounded-button" />
      </div>
    </div>
  )
}

/** KPI / metric card (icon, label, value). */
export function StatCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-button" />
        <Skeleton className="h-4 w-10" />
      </div>
      <Skeleton className="mt-4 h-3 w-24" />
      <Skeleton className="mt-2 h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  )
}

/** Generic content card used inside responsive grids (clients, invoices…). */
export function GridCardSkeleton() {
  return (
    <div className="rounded-card border border-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <div className="mt-5 flex items-end justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

/** Card wrapping a chart placeholder. */
export function ChartCardSkeleton({ height = 'h-[250px]' }: { height?: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-6">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className={`w-full ${height}`} />
    </div>
  )
}

/** Label + input pair used inside forms. */
export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-full rounded-button" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full-page compositions (used by loading.tsx and in-page loading states)
// ---------------------------------------------------------------------------

/** Card-grid list pages: clients, invoices, projects, expenses, estimates… */
export function CardGridSkeleton({
  count = 6,
  withToolbar = false,
}: {
  count?: number
  withToolbar?: boolean
}) {
  return (
    <div className="min-h-[70vh]">
      <PageHeaderSkeleton />
      {withToolbar && <ToolbarSkeleton />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <GridCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/** Vertical table/list pages (rows instead of cards). */
export function TableListSkeleton({
  rows = 8,
  withToolbar = true,
}: {
  rows?: number
  withToolbar?: boolean
}) {
  return (
    <div className="min-h-[70vh]">
      <PageHeaderSkeleton />
      {withToolbar && <ToolbarSkeleton />}
      <div className="overflow-hidden rounded-card border border-border bg-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 border-b border-border/60 p-4 last:border-b-0"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="h-6 w-20 rounded-button" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Dashboard home: header, period selector, KPI cards, charts and a table. */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      <PageHeaderSkeleton />
      <Skeleton className="mb-6 h-10 w-48 rounded-button" />
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <div className="rounded-card border border-border bg-card p-6">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Detail pages (`[id]`): header with actions plus content cards. */
export function DetailPageSkeleton() {
  return (
    <div className="min-h-[70vh]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-button" />
          <Skeleton className="h-10 w-24 rounded-button" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-card border border-border bg-card p-6 lg:col-span-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
          <Skeleton className="h-px w-full" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-card border border-border bg-card p-6">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
          <Skeleton className="h-10 w-full rounded-button" />
        </div>
      </div>
    </div>
  )
}

/** Create/edit form pages. */
export function FormPageSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="mx-auto min-h-[70vh] max-w-3xl">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-5 rounded-card border border-border bg-card p-6">
        {Array.from({ length: fields }).map((_, i) => (
          <FormFieldSkeleton key={i} />
        ))}
        <div className="flex justify-end gap-3 pt-2">
          <Skeleton className="h-10 w-24 rounded-button" />
          <Skeleton className="h-10 w-32 rounded-button" />
        </div>
      </div>
    </div>
  )
}

/** Reports/analytics pages: filters, KPI cards and charts. */
export function ReportsSkeleton() {
  return (
    <div className="min-h-screen">
      <PageHeaderSkeleton />
      <ToolbarSkeleton />
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCardSkeleton height="h-[300px]" />
        <ChartCardSkeleton height="h-[300px]" />
      </div>
    </div>
  )
}

/** Settings pages: stacked sections of form fields. */
export function SettingsSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="mx-auto min-h-[70vh] max-w-3xl">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: sections }).map((_, s) => (
          <div key={s} className="space-y-4 rounded-card border border-border bg-card p-6">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <FormFieldSkeleton key={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Subscription/pricing pages: plan cards. */
export function SubscriptionSkeleton() {
  return (
    <div className="min-h-[70vh]">
      <div className="mb-8 space-y-2 text-center">
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-card border border-border bg-card p-6">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-9 w-32" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
            <Skeleton className="h-10 w-full rounded-button" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Full dashboard chrome (sidebar + header + content) shown before the client
 * layout mounts. Prevents the blank flash that occurred while the layout
 * returned `null` during hydration.
 */
export function DashboardChromeSkeleton() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="hidden w-64 shrink-0 border-r border-border bg-surface p-4 md:block">
        <Skeleton className="mb-8 h-8 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-button" />
          ))}
        </div>
      </div>
      {/* Main */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border p-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <DashboardSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Backwards-compatible section skeletons (kept from the original module)
// ---------------------------------------------------------------------------

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
