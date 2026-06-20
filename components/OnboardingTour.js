'use client';

import Joyride from 'react-joyride';
import { useState, useEffect } from 'react';

const steps = [
  {
    target: '.sidebar-nav',
    content: 'Navigate between invoices, clients, expenses, and reports.',
    title: '📁 Sidebar Navigation',
  },
  {
    target: '.dashboard-stats',
    content: 'See your key business metrics at a glance.',
    title: '📊 Dashboard Stats',
  },
  {
    target: '.create-invoice-btn',
    content: 'Click here to create your first invoice.',
    title: '➕ Create Invoice',
  },
  {
    target: '.ai-assistant-btn',
    content: 'Ask AI to generate invoice descriptions or analyze data.',
    title: '🤖 AI Assistant',
  },
  {
    target: '.language-switcher',
    content: 'Switch between English, Spanish, French, and Arabic.',
    title: '🌐 Language Switcher',
  },
];

export default function OnboardingTour() {
  const [run, setRun] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const hasSeen = localStorage.getItem('onboarding-complete');
    if (!hasSeen) {
      setRun(true);
    }
  }, []);

  const handleCallback = (data) => {
    if (data.status === 'finished' || data.status === 'skipped') {
      localStorage.setItem('onboarding-complete', 'true');
      setRun(false);
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: '#8b5cf6',
          backgroundColor: '#ffffff',
          textColor: '#1f2937',
          arrowColor: '#ffffff',
          zIndex: 1000,
        },
      }}
      locale={{
        back: '← Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next →',
        skip: 'Skip tour',
      }}
    />
  );
}
