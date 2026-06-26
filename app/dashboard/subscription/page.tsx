'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SubscriptionSkeleton } from '@/components/LoadingSkeleton';
import { useTranslations } from 'next-intl';
import {
  PLAN_ORDER,
  getPlan,
  comparePlans,
  isContactSales,
} from '@/lib/subscriptions/plans';
import TeamSsoSettings from '@/components/TeamSsoSettings';

const CONTACT_SALES_EMAIL = 'info@sheetinvoicer.com';

interface User {
  id: string;
  email?: string;
}

// Monthly display price for a tier; null means custom (contact sales).
function priceLabel(name: string): string | null {
  const p = getPlan(name);
  if (p.billingModel === 'contact_sales') return null;
  return `$${p.monthlyPrice}`;
}

// Build the translated feature bullet list for a tier from the central config
// so the UI never drifts from lib/subscriptions/plans.js.
function featureLines(name: string, tp: any): string[] {
  const p = getPlan(name);
  const lines: string[] = [];
  lines.push(p.limits.invoices === null ? tp('features.unlimitedInvoices') : tp('features.invoicesLimited', { count: p.limits.invoices }));
  lines.push(p.limits.clients === null ? tp('features.unlimitedClients') : tp('features.clientsLimited', { count: p.limits.clients }));
  lines.push(p.limits.expenses === null ? tp('features.unlimitedExpenses') : tp('features.expensesLimited', { count: p.limits.expenses }));
  lines.push(tp('features.basicReports'));
  const seats = p.limits.teamMembers;
  if (seats === null) lines.push(tp('features.unlimitedTeam'));
  else if (seats > 1) lines.push(tp('features.teamMembers', { count: seats }));
  const order = ['aiAssistant', 'multiLanguage', 'multiCurrency', 'userRoles', 'adminAi', 'auditLog', 'bankSync', 'prioritySupport', 'sso', 'customBranding', 'dedicatedSupport', 'customIntegrations'];
  for (const f of order) {
    if (p.features.includes(f)) lines.push(tp(`features.${f}`));
  }
  return lines;
}

export default function SubscriptionPage() {
  const t = useTranslations('subscription');
  const tp = useTranslations('subscriptionPlans');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  // Upgrade CTAs elsewhere in the app link to /dashboard/subscription#plans.
  // While the subscription data is loading we only render a skeleton, so the
  // plans grid (#plans) is not in the DOM yet and the browser's native hash
  // scroll is a no-op. Once loading finishes, honor the hash ourselves and
  // smooth-scroll to the plans section so those buttons land on the plans.
  useEffect(() => {
    if (loading) return;
    if (typeof window === 'undefined' || window.location.hash !== '#plans') return;
    const target = document.getElementById('plans');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  async function handleCancel() {
    if (!window.confirm(t('cancelConfirm'))) return;
    setCancelMessage(null);
    setError(null);
    setCanceling(true);
    try {
      const res = await fetch('/api/stripe/cancel-subscription', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setCancelAtPeriodEnd(true);
        if (data.currentPeriodEnd) {
          setPeriodEnd(data.currentPeriodEnd);
        }
        setCancelMessage(t('cancelSuccess'));
      } else {
        setError(data.error || t('cancelError'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cancelError'));
    } finally {
      setCanceling(false);
    }
  }

  async function startCheckout(planName: string) {
    const res = await fetch('/api/stripe/create-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: planName,
        userId: userId || undefined,
        customerEmail: userEmail || undefined,
        successUrl: window.location.origin + '/dashboard?subscription=success',
        cancelUrl: window.location.href,
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error || t('checkoutError'));
  }

  // Switch tiers. Existing paid subscribers change plan in place (prorated);
  // everyone else goes through a fresh checkout.
  async function handleSwitch(planName: string) {
    if (currentPlan === planName) return;
    setError(null);
    setCancelMessage(null);
    setUpgrading(planName);
    try {
      const onPaid = Boolean(currentPlan && currentPlan !== 'Free');
      if (onPaid) {
        const res = await fetch('/api/stripe/change-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: planName }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const downgrade = currentPlan ? comparePlans(currentPlan, planName) > 0 : false;
          setCurrentPlan(data.plan);
          setCancelMessage(
            downgrade
              ? tp('proration.downgraded', { plan: data.label || planName })
              : tp('proration.upgraded', { plan: data.label || planName }),
          );
          loadSubscription();
        } else if (data.action === 'checkout') {
          await startCheckout(planName);
        } else {
          setError(data.error || t('checkoutError'));
        }
      } else {
        await startCheckout(planName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('checkoutError'));
    } finally {
      setUpgrading(null);
    }
  }

  async function loadSubscription() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      if (!supabase) {
        setError(t('supabaseInitError'));
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase.auth.getUser();

      if (queryError) {
        throw queryError;
      }

      if (data?.user) {
        const user: User = data.user;
        setUserId(user.id);
        setUserEmail(data.user.email ?? null);
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('plan, cancel_at_period_end, current_period_end')
          .eq('user_id', user.id)
          .maybeSingle();

        // A missing subscription row is expected for users on the Free plan and
        // must NOT be treated as a fatal error (which would hide all plans).
        if (subscriptionError && subscriptionError.code !== 'PGRST116') {
          throw subscriptionError;
        }

        if (subscriptionData) {
          setCurrentPlan(subscriptionData.plan);
          setCancelAtPeriodEnd(Boolean(subscriptionData.cancel_at_period_end));
          setPeriodEnd(subscriptionData.current_period_end ?? null);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('loadError');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <SubscriptionSkeleton />;
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{t('subtitle')}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{t('errorLabel')}: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            {t('tryAgain')}
          </button>
        </div>
      )}

      <div id="plans" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 scroll-mt-24">
        {PLAN_ORDER.map((name) => {
          const def = getPlan(name);
          const popular = name === 'Pro';
          const isCurrent = currentPlan === name || (!currentPlan && name === 'Free');
          const price = priceLabel(name);
          const lines = featureLines(name, tp);
          const busy = upgrading === name;

          let label: string;
          let disabled = false;
          let onClick: () => void = () => {};
          if (isCurrent) {
            label = tp('actions.current');
            disabled = true;
          } else if (isContactSales(name)) {
            label = tp('actions.contactSales');
            onClick = () => { window.location.href = `mailto:${CONTACT_SALES_EMAIL}`; };
          } else if (name === 'Free') {
            label = t('freePlanButton');
            disabled = true;
          } else {
            const up = !currentPlan || comparePlans(currentPlan, name) < 0;
            label = up ? tp('actions.upgrade', { plan: def.name }) : tp('actions.downgrade', { plan: def.name });
            onClick = () => handleSwitch(name);
          }

          return (
            <div
              key={name}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 p-6 transition-transform duration-150 hover:-translate-y-1 ${
                isCurrent ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                  {tp('mostPopular')}
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-4 right-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full text-xs">
                  {tp('currentPlan')}
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{tp(`tiers.${name.toLowerCase()}.name`)}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{tp(`tiers.${name.toLowerCase()}.tagline`)}</p>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                {price ?? tp('customPricing')}
                {price && <span className="text-lg font-normal text-gray-500 dark:text-gray-400">{tp('perMonth')}</span>}
              </div>
              <ul className="space-y-2 mb-6">
                {lines.map((line, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span>✅</span> {line}
                  </li>
                ))}
              </ul>
              <button
                onClick={onClick}
                disabled={disabled || busy}
                className={`w-full py-3 rounded-xl font-medium transition-all ${
                  disabled
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
                }`}
              >
                {busy ? t('redirecting') : label}
              </button>
            </div>
          );
        })}
      </div>

      {currentPlan && currentPlan !== 'Free' && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {t('manageTitle')}
          </h2>
          {cancelAtPeriodEnd ? (
            <p className="text-gray-600 dark:text-gray-300">
              {periodEnd
                ? t('cancelScheduledUntil', { date: periodEnd })
                : t('cancelScheduled')}
            </p>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-300 mb-4">{t('manageDescription')}</p>
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="px-5 py-3 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-60"
              >
                {canceling ? t('canceling') : t('cancelButton')}
              </button>
            </>
          )}
          {cancelMessage && (
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">{cancelMessage}</p>
          )}
        </div>
      )}

      <TeamSsoSettings />
    </div>
  );
}