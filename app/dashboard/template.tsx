/**
 * Wraps every dashboard page in a fade-in transition that replays on each
 * navigation.
 *
 * Next.js gives `template.tsx` a unique key per route segment, so it remounts
 * on every navigation. That makes the `.page-transition` animation (defined in
 * app/globals.css) run again each time the user switches pages, replacing the
 * abrupt content swap with a smooth fade. The template wraps both the route's
 * `loading.tsx` skeleton and its page, so the skeleton fades in instantly and
 * the real content takes its place without a jump.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="page-transition">{children}</div>
}
