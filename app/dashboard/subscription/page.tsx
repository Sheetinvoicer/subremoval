'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

interface Plan {
  name: string;
  price: string;
  features: string[];
  popular: boolean;
  color: string;
}

interface User {
  id: string;
  email?: string;
}

const plans: Plan[] = [
  { name: 'Free', price: '$0', features: ['5 invoices/month', 'Basic reports', 'Email support'], popular: false, color: 'gray' },
  { name: 'Pro', price: '$9', features: ['Unlimited invoices', 'Client portal', 'Recurring invoices', 'API access'], popular: true, color: 'blue' },
  { name: 'Business', price: '$29', features: ['Everything in Pro', 'Team members', 'Advanced analytics', 'Priority support'], popular: false, color: 'purple' },
];

export default function SubscriptionPage() {
  const t = useTranslations('subscription');
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

  async function handleUpgrade(planName: string) {
    if (planName === 'Free' || currentPlan === planName) return;
    setError(null);
    setUpgrading(planName);
    try {
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
      } else {
        setError(data.error || 'Failed to start checkout');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
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
        setError("Failed to initialize Supabase client");
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to load subscription';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Subscription</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your plan and billing</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 p-6 transition-transform duration-150 hover:-translate-y-1 ${
              currentPlan === plan.name
                ? 'border-blue-500 dark:border-blue-400'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                Most Popular
              </div>
            )}
            {currentPlan === plan.name && (
              <div className="absolute top-4 right-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full text-xs">
                Current Plan
              </div>
            )}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h2>
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{plan.price}<span className="text-lg font-normal text-gray-500 dark:text-gray-400">/month</span></div>
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <span>✅</span> {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade(plan.name)}
              disabled={currentPlan === plan.name || plan.name === 'Free' || upgrading !== null}
              className={`w-full py-3 rounded-xl font-medium transition-all ${
                currentPlan === plan.name || plan.name === 'Free'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : `bg-${plan.color}-600 hover:bg-${plan.color}-700 text-white disabled:opacity-60`
              }`}
            >
              {currentPlan === plan.name
                ? 'Current Plan'
                : plan.name === 'Free'
                  ? 'Free Plan'
                  : upgrading === plan.name
                    ? 'Redirecting…'
                    : `Upgrade to ${plan.name}`}
            </button>
          </div>
        ))}
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
    </div>
  );
}