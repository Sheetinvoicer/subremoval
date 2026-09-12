import Link from 'next/link'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Terms of Service — SubRemoval',
  description: 'Terms of service for using SubRemoval.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <nav className="p-6 max-w-4xl mx-auto w-full border-b border-gray-200 dark:border-gray-800">
        <Link href="/" className="text-2xl font-bold text-purple-600">SubRemoval</Link>
      </nav>
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">Terms of Service</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-10">Last updated: September 12, 2026</p>

        <div className="space-y-8 text-gray-600 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">1. Agreement to Terms</h2>
            <p>By creating a SubRemoval account or using our service, you agree to these Terms of Service and our <Link href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>. If you disagree, do not use the service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">2. What SubRemoval Does</h2>
            <p>SubRemoval scans your Gmail inbox for subscription receipts and billing emails. It detects the services you&rsquo;re paying for, surfaces the amounts and renewal dates, and provides direct links to cancel each subscription.</p>
            <p className="mt-3"><strong>SubRemoval does not:</strong></p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Cancel subscriptions on your behalf</li>
              <li>Contact merchants or service providers</li>
              <li>Guarantee that every subscription will be detected</li>
              <li>Guarantee that detected amounts are 100% accurate</li>
            </ul>
            <p className="mt-3">You are responsible for verifying any detected subscription before cancelling, and for cancelling the service directly with the provider.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">3. User Accounts</h2>
            <p>To use SubRemoval, you must create an account. You agree to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide accurate information</li>
              <li>Keep your password secure</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">4. Gmail Access</h2>
            <p>SubRemoval uses the <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-sm">gmail.readonly</code> scope to read your emails. You authorize us to scan your Gmail inbox for subscription-related emails. You may revoke this access at any time at <a href="https://myaccount.google.com/permissions" className="text-purple-600 hover:underline" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a> or by disconnecting Gmail in SubRemoval Settings.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">5. Pricing &amp; Payment</h2>
            <p>SubRemoval is sold as a <strong>one-time $4.99 payment</strong> for lifetime access. There is no recurring subscription, no auto-renewal, and no hidden fees.</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Price:</strong> $4.99 USD one-time</li>
              <li><strong>What you get:</strong> Unlimited lifetime access, 3 scans per month</li>
              <li><strong>Payment processor:</strong> Stripe, Inc.</li>
              <li><strong>Auto-renewal:</strong> None. You will never be charged again.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">6. Refund Policy</h2>
            <p>We offer a <strong>30-day money-back guarantee</strong>. If SubRemoval does not detect any subscriptions you were paying for, or if you are otherwise unsatisfied within 30 days of purchase, email <a href="mailto:support@subremoval.com" className="text-purple-600 hover:underline">support@subremoval.com</a> for a full refund. No questions asked.</p>
            <p className="mt-3">After 30 days, refunds are at our discretion. Duplicate purchases will always be refunded.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use SubRemoval to scan Gmail accounts you do not own</li>
              <li>Attempt to reverse-engineer, scrape, or abuse our API</li>
              <li>Share your account with others</li>
              <li>Use the service for illegal purposes</li>
              <li>Attempt to bypass the 3 scans per month limit</li>
            </ul>
            <p className="mt-3">We reserve the right to terminate accounts that violate these rules.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">8. Scan Limits</h2>
            <p>Lifetime accounts include <strong>3 scans per month</strong>. This limit resets on the 1st of each calendar month. The limit exists to protect against abuse of third-party API costs. If you need more scans, contact us.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">9. Service Availability</h2>
            <p>We strive to keep SubRemoval available, but we do not guarantee 100% uptime. We may temporarily suspend the service for maintenance or updates. We are not liable for outages or data loss caused by third-party providers (Google, Supabase, Stripe, Vercel).</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">10. Limitation of Liability</h2>
            <p>SubRemoval is provided &ldquo;as is&rdquo; without warranty. We are not liable for:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Subscriptions you miss or fail to cancel</li>
              <li>Incorrect amounts or dates detected by our AI</li>
              <li>Financial decisions you make based on our data</li>
              <li>Indirect, incidental, or consequential damages</li>
            </ul>
            <p className="mt-3">Our total liability is limited to the amount you paid us ($4.99).</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">11. Account Termination</h2>
            <p>You may delete your account at any time from Settings. Upon deletion:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your Gmail tokens are deleted immediately</li>
              <li>Your detected subscriptions are deleted immediately</li>
              <li>Your account data is deleted immediately</li>
              <li>Your $4.99 payment is not refunded after 30 days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">12. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict-of-law principles. Any dispute will be resolved in the courts of Delaware.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">13. Changes to Terms</h2>
            <p>We may update these Terms from time to time. Continued use of SubRemoval after changes constitutes acceptance of the new Terms.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">14. Contact</h2>
            <p>Questions? Email <a href="mailto:support@subremoval.com" className="text-purple-600 hover:underline">support@subremoval.com</a>.</p>
          </section>

        </div>
      </main>
      <Footer />
    </div>
  )
}
