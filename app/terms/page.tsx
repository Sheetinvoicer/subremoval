"use client";


import Link from 'next/link'
import Footer from '@/components/Footer'

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="p-6 max-w-4xl mx-auto w-full">
        <Link href="/" className="text-2xl font-bold text-blue-600">SheetInvoicer</Link>
      </nav>
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Last updated: June 20, 2026</p>
        
        <div className="space-y-8 text-gray-600 dark:text-gray-300">
          
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Agreement to Terms</h2>
            <p>By accessing or using SheetInvoicer ("the Service"), you agree to be bound by these Terms of Service and our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>. If you disagree with any part of these terms, you may not access the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. Description of Service</h2>
            <p>SheetInvoicer provides invoice generation, management, and payment processing tools for businesses and individuals. Features include:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Invoice creation and customization</li>
              <li>Client management</li>
              <li>Payment processing via Stripe</li>
              <li>CSV import for bulk invoicing</li>
              <li>Email notifications and reminders</li>
              <li>Recurring invoice scheduling</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. User Accounts</h2>
            <p>To use the Service, you must create an account. You agree to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your password</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Subscription and Payments</h2>
            <p>SheetInvoicer offers both free and paid subscription plans:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Free Plan:</strong> Limited to 5 invoices per month</li>
              <li><strong>Pro Plan ($29/month):</strong> Unlimited invoices, clients, and advanced features</li>
              <li><strong>Business Plan ($99/month):</strong> All Pro features plus team access and API</li>
            </ul>
            <p className="mt-3">Payments are processed securely through Stripe. Subscriptions auto-renew monthly or annually unless cancelled 24 hours before renewal.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Data Ownership and Privacy</h2>
            <p>You retain all ownership rights to the data you create using SheetInvoicer. We do not claim ownership of your invoices, client data, or business information. Our use of your data is governed by our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Acceptable Use Policy</h2>
            <p>You agree not to use SheetInvoicer for:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Illegal activities or fraud</li>
              <li>Sending spam or unsolicited emails</li>
              <li>Harassment or abuse of others</li>
              <li>Infringing on intellectual property rights</li>
              <li>Distributing malware or harmful code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Cancellation and Termination</h2>
            <p>You may cancel your subscription at any time from your account settings. Upon cancellation:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your paid features will continue until the end of your billing period</li>
              <li>You will be downgraded to the Free plan</li>
              <li>Data exceeding free plan limits will be viewable but not editable</li>
            </ul>
            <p className="mt-3">You can also permanently delete your account and associated personal data from Dashboard Settings. We reserve the right to suspend or terminate accounts for violation of these terms or extended inactivity.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">8. Limitation of Liability</h2>
            <p>SheetInvoicer is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we are not liable for:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Any indirect, incidental, or consequential damages</li>
              <li>Loss of profits, data, or business opportunities</li>
              <li>Service interruptions or data loss</li>
              <li>Third-party service failures (Stripe, Supabase, Resend)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">9. Changes to Terms</h2>
            <p>We may modify these terms at any time. We will notify users of material changes via email or dashboard notice. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">10. Governing Law</h2>
            <p>These terms shall be governed by the laws of the State of Delaware, without regard to conflict of law principles.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">11. Contact Information</h2>
            <p className="mb-2">For questions about these Terms of Service, please contact us at:</p>
            <p>
              <a href="mailto:legal@sheetinvoicer.com" className="text-blue-600 hover:underline">
                📧 legal@sheetinvoicer.com
              </a>
            </p>
            <p className="mt-2 text-sm text-gray-500">Response within 2-3 business days</p>
          </section>

          <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              By using SheetInvoicer, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
