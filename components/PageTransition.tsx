'use client'

import { usePathname } from 'next/navigation'

/**
 * Smooth page transition wrapper.
 *
 * Re-keys its subtree on every route change so the `page-transition`
 * fade-in animation (defined in globals.css) replays between pages.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  )
}
