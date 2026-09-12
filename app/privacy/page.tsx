import Link from 'next/link'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Privacy Policy — SubRemoval',
  description: 'How SubRemoval handles your data, including Gmail access and Google user data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950">
      <nav className="p-6 max-w-4xl mx-auto w-full border-b border-gray-200 dark:border-gray-800">
        <Link href="/" className="text-2xl font-bold text-purple-600">SubRemoval</Link>
      </nav>
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">Privacy Policy</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-10">Last updated: September 12, 2026</p>

        <div className="space-y-8 text-gray-600 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Overview</h2>
            <p>SubRemoval (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is operated by Feras Al Fanatseh LLC. SubRemoval scans your Gmail inbox to detect recurring subscription charges and helps you cancel unwanted subscriptions. This Privacy Policy explains what data we collect, how we use it, and your rights.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">1. Information We Collect</h2>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">Account Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Email address</li>
              <li>Hashed password (never stored in plaintext)</li>
              <li>Optional display name</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">Google User Data (Gmail)</h3>
            <p>When you connect your Google account, SubRemoval requests the <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-sm">gmail.readonly</code> scope. This allows our service to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Read the contents of your Gmail messages (subject lines and message bodies)</li>
              <li>Read email metadata (sender, recipient, date, links contained in emails)</li>
            </ul>
            <p className="mt-3"><strong>SubRemoval uses this access for one purpose only:</strong> to identify subscription receipts, renewal notices, and billing emails so we can surface your recurring charges in your SubRemoval dashboard.</p>
            <p className="mt-3"><strong>What we do NOT do:</strong></p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>We never send emails on your behalf</li>
              <li>We never delete or modify your emails</li>
              <li>We never share your email content with third parties for advertising</li>
              <li>We never read emails outside of the subscription-detection process</li>
              <li>We never sell your data</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">Subscription Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Service names and amounts detected from your emails</li>
              <li>Cancel URLs found in receipt emails</li>
              <li>Detected payment status (success / failed / cancelled)</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">Payment Information</h3>
            <p>Payments are processed by Stripe, Inc. We never see or store your full credit card number. Stripe shares only the payment confirmation, your email address, and the last 4 digits of your card with us.</p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">Usage Data</h3>
            <p>We collect basic usage data such as number of scans run, errors encountered, and page views. This helps us improve SubRemoval.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To scan your Gmail inbox and detect recurring subscriptions</li>
              <li>To display detected subscriptions and cancel links in your dashboard</li>
              <li>To process your one-time $4.99 payment via Stripe</li>
              <li>To send you technical notices, security alerts, and support responses</li>
              <li>To detect and prevent abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">3. Third-Party Sub-Processors</h2>
            <p>We share data only with these essential service providers:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Google (Gmail API):</strong> To read your emails. <a href="https://policies.google.com/privacy" className="text-purple-600 hover:underline" target="_blank" rel="noreferrer">Google Privacy Policy</a></li>
              <li><strong>Google (Gemini AI):</strong> To analyze email content and identify subscriptions. Email text is sent to Google&rsquo;s Gemini API for classification. <a href="https://ai.google.dev/gemini-api/terms" className="text-purple-600 hover:underline" target="_blank" rel="noreferrer">Gemini API Terms</a></li>
              <li><strong>Supabase:</strong> Database and authentication hosting. <a href="https://supabase.com/privacy" className="text-purple-600 hover:underline" target="_blank" rel="noreferrer">Supabase Privacy Policy</a></li>
              <li><strong>Stripe:</strong> Payment processing. <a href="https://stripe.com/privacy" className="text-purple-600 hover:underline" target="_blank" rel="noreferrer">Stripe Privacy Policy</a></li>
              <li><strong>Vercel:</strong> Application hosting. <a href="https://vercel.com/legal/privacy-policy" className="text-purple-600 hover:underline" target="_blank" rel="noreferrer">Vercel Privacy Policy</a></li>
            </ul>
            <p className="mt-3">We do not sell, rent, or share your personal data with advertisers or any other third parties.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">4. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account data:</strong> Retained while your account is active</li>
              <li><strong>Gmail access tokens:</strong> Deleted immediately when you disconnect Gmail or delete your account</li>
              <li><strong>Detected subscriptions:</strong> Deleted when you delete your account</li>
              <li><strong>Email content:</strong> We do not store raw email bodies after processing. Only extracted subscription details are retained.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Access</strong> your data &mdash; export all your data from the Settings page</li>
              <li><strong>Delete</strong> your data &mdash; click &ldquo;Delete account&rdquo; in Settings, or email <a href="mailto:support@subremoval.com" className="text-purple-600 hover:underline">support@subremoval.com</a></li>
              <li><strong>Revoke Gmail access</strong> &mdash; visit <a href="https://myaccount.google.com/permissions" className="text-purple-600 hover:underline" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a></li>
              <li><strong>Object to processing</strong> &mdash; contact us at the email above</li>
            </ul>
            <p className="mt-3">If you are a California resident, you have additional rights under CCPA. If you are an EU resident, you have rights under GDPR. Contact us for any data requests.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">6. Google API Services User Data Policy</h2>
            <p>SubRemoval&rsquo;s use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-purple-600 hover:underline" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">7. Security</h2>
            <p>We use industry-standard security practices including encryption in transit (HTTPS/TLS), encrypted database storage, and access controls. However, no service is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">8. Children</h2>
            <p>SubRemoval is not intended for users under 16 years of age. We do not knowingly collect data from children.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Material changes will be communicated by email or via an in-app notice.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">10. Contact Us</h2>
            <p>Questions about your privacy? Email us at <a href="mailto:support@subremoval.com" className="text-purple-600 hover:underline">support@subremoval.com</a>.</p>
          </section>

        </div>
      </main>
      <Footer />
    </div>
  )
}
