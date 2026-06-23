'use client'

import { usePathname } from 'next/navigation'

/**
 * Smooth page transition wrapper.
 *
 * Re-keys its subtree by the *top-level* route segment (e.g. `dashboard`,
 * `pricing`) — not the full pathname — so the `page-transition` fade replays
 * when moving between major sections, while navigating *within* a section does
 * not remount the subtree.
 *
 * This matters for the dashboard: the dashboard layout (sidebar/header) lives
 * inside this wrapper, so keying by the full pathname used to tear it down and
 * rebuild it on every navigation, re-running its mount gate and replaying the
 * fade for the whole shell — the main cause of the content "bounce" between
 * pages. Per-page fades within the dashboard are handled by
 * `app/dashboard/template.tsx` instead, which lets the layout persist.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  // First path segment, e.g. "/dashboard/clients" -> "dashboard". Falls back to
  // "root" for "/". There is no locale prefix in the URL (next-intl is
  // configured without i18n routing), so this is stable across locales.
  const section = pathname?.split('/')[1] || 'root'

  return (
    <div key={section} className="page-transition">
      {children}
    </div>
  )
}
