'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface Plan {
  name: string;
  price: string;
  features: string[];
  popular: boolean;
  color: string;
}

interface User {
  id: string;
}

const plans: Plan[] = [
  { name: 'Free', price: '$0', features: ['5 invoices/month', 'Basic reports', 'Email support'], popular: false, color: 'gray' },
  { name: 'Pro', price: '$9', features: ['Unlimited invoices', 'Client portal', 'Recurring invoices', 'API access'], popular: true, color: 'blue' },
  { name: 'Business', price: '$29', features: ['Everything in Pro', 'Team members', 'Advanced analytics', 'Priority support'], popular: false, color: 'purple' },
];

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    loadSubscription();
  }, []);

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
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('plan')
          .eq('user_id', user.id)
          .single();

        if (subscriptionError) {
          throw subscriptionError;
        }

        if (subscriptionData) {
          setCurrentPlan(subscriptionData.plan);
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Subscription</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your plan and billing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, idx) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -5 }}
            className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 p-6 ${
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
              disabled={currentPlan === plan.name}
              className={`w-full py-3 rounded-xl font-medium transition-all ${
                currentPlan === plan.name
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : `bg-${plan.color}-600 hover:bg-${plan.color}-700 text-white`
              }`}
            >
              {currentPlan === plan.name ? 'Current Plan' : `Upgrade to ${plan.name}`}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}