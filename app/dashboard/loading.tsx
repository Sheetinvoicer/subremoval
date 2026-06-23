import { DashboardSkeleton } from '@/components/LoadingSkeleton'

// Instant loading UI shown on navigation to the dashboard home while the route
// segment streams in. Mirrors the real page so there is no content jump.
export default function Loading() {
  return <DashboardSkeleton />
}
