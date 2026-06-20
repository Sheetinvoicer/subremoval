"use client";
"use client";


import Link from 'next/link'
import Footer from '@/components/Footer'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="p-6 max-w-4xl mx-auto w-full">
        <Link href="/" className="text-2xl font-bold text-blue-600">SheetInvoicer</Link>
      </nav>
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Last updated: June 1, 2026</p>
        
        <div className="space-y-8 text-gray-600 dark:text-gray-300">
          
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Information We Collect</h2>
            <p>We collect information you provide directly to us:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Account Information:</strong> Name, email address, password</li>
              <li><strong>Business Information:</strong> Company name, address, tax ID, logo</li>
              <li><strong>Client Data:</strong> Client names, emails, addresses, invoice history</li>
              <li><strong>Payment Information:</strong> Processed securely by Stripe (we never store full payment details)</li>
              <li><strong>Usage Data:</strong> How you interact with our service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process and deliver invoices and payments</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Monitor and analyze usage patterns</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Data Sharing and Disclosure</h2>
            <p>We do not sell your personal data. We share data only with essential third-party services:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Stripe:</strong> Process payments (PCI compliant)</li>
              <li><strong>Supabase:</strong> Host and manage database</li>
              <li><strong>Resend:</strong> Send email notifications</li>
              <li><strong>Vercel:</strong> Host the application</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Data Security</h2>
            <p>We implement industry-standard security measures:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>End-to-end encryption for sensitive data</li>
              <li>Regular security audits and penetration testing</li>
              <li>Secure SSL/TLS connections (HTTPS)</li>
              <li>Access controls and authentication</li>
              <li>Regular automated backups</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Data Retention</h2>
            <p>We retain your data as long as your account is active. Upon account deletion:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your data is permanently deleted within 30 days</li>
              <li>Anonymous usage data may be retained for analytics</li>
              <li>Certain records may be retained for legal compliance (tax, accounting)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Export your data (CSV format)</li>
              <li>Delete your account and data</li>
              <li>Opt out of marketing communications</li>
            </ul>
            <p className="mt-3">To exercise these rights, email <a href="mailto:privacy@sheetinvoicer.com" className="text-blue-600 hover:underline">privacy@sheetinvoicer.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Cookies and Tracking</h2>
            <p>We use cookies to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Authenticate and maintain your session</li>
              <li>Remember your preferences and settings</li>
              <li>Analyze usage patterns to improve our service</li>
            </ul>
            <p className="mt-3">You can disable cookies in your browser settings, but some features may not function properly.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Children's Privacy</h2>
            <p>SheetInvoicer is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">International Data Transfers</h2>
            <p>Your data may be transferred to and processed in the United States and other countries where our service providers operate. We ensure appropriate safeguards are in place.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. We will notify you of material changes via email or dashboard notice. The "Last updated" date indicates when changes were made.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Contact Us</h2>
            <p className="mb-2">If you have questions about this Privacy Policy or our data practices, please contact us:</p>
            <p>
              <a href="mailto:privacy@sheetinvoicer.com" className="text-blue-600 hover:underline">
                📧 privacy@sheetinvoicer.com
              </a>
            </p>
            <p className="mt-2 text-sm text-gray-500">We typically respond within 2-3 business days</p>
          </section>

          <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              Your trust is important to us. We are committed to protecting your privacy and handling your data with care and transparency.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
