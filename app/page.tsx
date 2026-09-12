import Link from 'next/link'
import { Mail, ScanSearch, ShieldCheck, CreditCard, Sparkles, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      {/* NAV */}
      <nav className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-700">
              <CreditCard size={18} />
            </span>
            <span className="text-xl font-bold">SubRemoval</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Get lifetime — $4.99
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm font-medium text-purple-300 mb-8">
          <Sparkles size={14} />
          Pay once. Use forever.
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-4xl mx-auto">
          Stop bleeding money
          <br />
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            in silence.
          </span>
        </h1>

        <p className="mt-8 text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          SubRemoval scans your Gmail and finds every forgotten subscription draining your account.
          Cancel them in 2 clicks. Pay once, use forever.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/pricing"
            className="group inline-flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-4 text-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Get lifetime access — $4.99
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          No monthly fee · 30-day money-back guarantee · Read-only Gmail
        </p>
      </section>

      {/* PROOF / STATS */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-4xl font-bold text-purple-400">$1,838</p>
            <p className="mt-2 text-sm text-gray-400">Average yearly spend found per user</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-purple-400">30 sec</p>
            <p className="mt-2 text-sm text-gray-400">From Gmail connect to seeing results</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-purple-400">7+</p>
            <p className="mt-2 text-sm text-gray-400">Forgotten subscriptions found per user</p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Mail,
              step: '01',
              title: 'Connect Gmail',
              body: 'Read-only access. We can scan receipts. We can never send, delete, or read anything else.',
            },
            {
              icon: ScanSearch,
              step: '02',
              title: 'Click scan',
              body: 'Our AI reads through 12 months of email in 30 seconds and finds every subscription you pay for.',
            },
            {
              icon: ShieldCheck,
              step: '03',
              title: 'Cancel everything',
              body: 'See every subscription in one list, with direct cancel links. Kill the ones you forgot about.',
            },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 hover:border-purple-500/50 transition-colors">
              <div className="flex items-center gap-4 mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                  <item.icon size={20} />
                </span>
                <span className="text-xs font-mono text-gray-500">{item.step}</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
              <p className="text-gray-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHY PAY ONCE */}
      <section className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Why pay once?
          </h2>
          <p className="text-xl text-gray-400 leading-relaxed mb-10">
            You hate subscriptions. So do we. <br />
            Pay <strong className="text-white">$4.99</strong>. Use it forever. That&apos;s it.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-4 text-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Get lifetime access — $4.99
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© 2026 SubRemoval. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <a href="mailto:support@subremoval.com" className="hover:text-white transition-colors">
              support@subremoval.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
