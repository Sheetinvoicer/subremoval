import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CookieConsentBanner from '@/components/CookieConsentBanner';

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
    localStorage.clear();
  });

  it('shows banner and stores acceptance choice', () => {
    render(<CookieConsentBanner />);

    expect(screen.getByText('Cookie Preferences')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }));

    expect(localStorage.getItem('cookieConsent')).toBe('accepted');
    expect(document.cookie).toContain('cookie_consent=accepted');
  });
});
