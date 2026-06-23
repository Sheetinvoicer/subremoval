import { Resend } from 'resend'

const FROM_ADDRESS = 'SheetInvoicer <noreply@sheetinvoicer.com>'

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return null
  }
  return new Resend(apiKey)
}

function wrapHtml(title, bodyHtml) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;">
      <h2 style="color:#111827;">${title}</h2>
      ${bodyHtml}
      <p style="margin-top:24px;">Thanks,<br/>SheetInvoicer</p>
    </div>
  `
}

const TEMPLATES = {
  active: ({ planName }) => ({
    subject: 'Your SheetInvoicer subscription is active',
    html: wrapHtml(
      'Subscription activated 🎉',
      `<p>Your <strong>${planName || 'subscription'}</strong> plan is now active.</p>
       <p>You now have full access to all the features included in your plan.</p>`,
    ),
  }),
  renewal: ({ planName, amount, currency }) => ({
    subject: 'Your SheetInvoicer subscription was renewed',
    html: wrapHtml(
      'Renewal successful ✅',
      `<p>Your <strong>${planName || 'subscription'}</strong> plan was renewed successfully.</p>
       ${amount ? `<p><strong>Amount:</strong> ${(currency || 'USD').toUpperCase()} ${Number(amount).toFixed(2)}</p>` : ''}
       <p>Thank you for continuing with SheetInvoicer.</p>`,
    ),
  }),
  payment_failed: ({ planName }) => ({
    subject: 'Action required: subscription payment failed',
    html: wrapHtml(
      'Payment failed ⚠️',
      `<p>We were unable to process the payment for your <strong>${planName || 'subscription'}</strong> plan.</p>
       <p>Please update your payment method to avoid losing access to your subscription.</p>`,
    ),
  }),
  canceled: ({ planName, periodEnd }) => ({
    subject: 'Your SheetInvoicer subscription was canceled',
    html: wrapHtml(
      'Subscription canceled',
      `<p>Your <strong>${planName || 'subscription'}</strong> plan has been canceled.</p>
       ${periodEnd ? `<p>You will keep access until <strong>${periodEnd}</strong>.</p>` : ''}
       <p>We're sorry to see you go. You can re-subscribe at any time.</p>`,
    ),
  }),
}

/**
 * Send a subscription-related notification email.
 * @param {('active'|'renewal'|'payment_failed'|'canceled')} type
 * @param {string} to recipient email address
 * @param {object} data template data ({ planName, amount, currency, periodEnd })
 */
export async function sendSubscriptionEmail(type, to, data = {}) {
  if (!to) {
    return { sent: false, reason: 'missing-recipient' }
  }

  const builder = TEMPLATES[type]
  if (!builder) {
    return { sent: false, reason: 'unknown-template' }
  }

  const resend = getResendClient()
  if (!resend) {
    return { sent: false, reason: 'missing-api-key' }
  }

  const { subject, html } = builder(data)

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    })

    if (error) {
      return { sent: false, reason: error.message || 'send-failed' }
    }

    return { sent: true }
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'send-failed' }
  }
}
