import { Skeleton } from '@/components/LoadingSkeleton'

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center space-y-4 text-center">
      <Skeleton className="h-16 w-16 rounded-full" />
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-10 w-40 rounded-button" />
    </div>
  )
}
