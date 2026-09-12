// Central directory of official billing pages + typical pricing for major
// consumer services. This is shared infrastructure — the same ~50 entries
// for every user, so it's fine to hardcode (unlike per-user app blacklists).

export interface KnownService {
  name: string
  cancelUrl: string
  typicalAmount?: number
  typicalCurrency?: string
}

export const KNOWN_SERVICES: Record<string, KnownService> = {
  'netflix.com':    { name: 'Netflix',    cancelUrl: 'https://www.netflix.com/cancelplan',                       typicalAmount: 15.49, typicalCurrency: 'USD' },
  'spotify.com':    { name: 'Spotify',    cancelUrl: 'https://www.spotify.com/account/subscription/',            typicalAmount: 11.99, typicalCurrency: 'USD' },
  'hulu.com':       { name: 'Hulu',       cancelUrl: 'https://secure.hulu.com/account',                          typicalAmount: 17.99, typicalCurrency: 'USD' },
  'disneyplus.com': { name: 'Disney+',    cancelUrl: 'https://www.disneyplus.com/account',                      typicalAmount: 13.99, typicalCurrency: 'USD' },
  'max.com':        { name: 'Max',        cancelUrl: 'https://www.max.com/account',                              typicalAmount: 16.99, typicalCurrency: 'USD' },
  'youtube.com':    { name: 'YouTube Premium', cancelUrl: 'https://www.youtube.com/paid_memberships',           typicalAmount: 13.99, typicalCurrency: 'USD' },

  'adobe.com':      { name: 'Adobe',      cancelUrl: 'https://account.adobe.com/plans',                          typicalAmount: 22.99, typicalCurrency: 'USD' },
  'microsoft.com':  { name: 'Microsoft 365', cancelUrl: 'https://account.microsoft.com/services',                typicalAmount: 9.99,  typicalCurrency: 'USD' },
  'dropbox.com':    { name: 'Dropbox',    cancelUrl: 'https://www.dropbox.com/account/billing',                  typicalAmount: 11.99, typicalCurrency: 'USD' },
  'notion.so':      { name: 'Notion',     cancelUrl: 'https://www.notion.so/my-integrations/billing',           typicalAmount: 10,    typicalCurrency: 'USD' },
  'figma.com':      { name: 'Figma',      cancelUrl: 'https://www.figma.com/settings/billing',                   typicalAmount: 15,    typicalCurrency: 'USD' },
  'github.com':     { name: 'GitHub',     cancelUrl: 'https://github.com/settings/billing',                      typicalAmount: 4,     typicalCurrency: 'USD' },
  'slack.com':      { name: 'Slack',      cancelUrl: 'https://slack.com/help/articles/360044890453',             typicalAmount: 8.75,  typicalCurrency: 'USD' },
  'zoom.us':        { name: 'Zoom',       cancelUrl: 'https://zoom.us/billing',                                  typicalAmount: 15.99, typicalCurrency: 'USD' },
  'canva.com':      { name: 'Canva',      cancelUrl: 'https://www.canva.com/settings/billing-and-teams',        typicalAmount: 12.99, typicalCurrency: 'USD' },
  'grammarly.com':  { name: 'Grammarly',  cancelUrl: 'https://account.grammarly.com/subscription',               typicalAmount: 12,    typicalCurrency: 'USD' },
  '1password.com':  { name: '1Password',  cancelUrl: 'https://my.1password.com/billing',                         typicalAmount: 2.99,  typicalCurrency: 'USD' },
  'jetbrains.com':  { name: 'JetBrains',  cancelUrl: 'https://account.jetbrains.com/subscriptions',              typicalAmount: 16.90, typicalCurrency: 'USD' },

  'openai.com':     { name: 'OpenAI',     cancelUrl: 'https://platform.openai.com/account/billing/overview',    typicalAmount: 20,    typicalCurrency: 'USD' },
  'anthropic.com':  { name: 'Anthropic',  cancelUrl: 'https://console.anthropic.com/settings/billing',          typicalAmount: 20,    typicalCurrency: 'USD' },
  'claude.ai':      { name: 'Claude Pro', cancelUrl: 'https://claude.ai/settings/billing',                      typicalAmount: 20,    typicalCurrency: 'USD' },
  'midjourney.com': { name: 'Midjourney', cancelUrl: 'https://www.midjourney.com/account',                      typicalAmount: 10,    typicalCurrency: 'USD' },
  'cursor.com':     { name: 'Cursor',     cancelUrl: 'https://www.cursor.com/settings',                         typicalAmount: 20,    typicalCurrency: 'USD' },
  'cursor.sh':      { name: 'Cursor',     cancelUrl: 'https://www.cursor.com/settings',                         typicalAmount: 20,    typicalCurrency: 'USD' },

  'vercel.com':     { name: 'Vercel',     cancelUrl: 'https://vercel.com/account/billing',                      typicalAmount: 20,    typicalCurrency: 'USD' },
  'railway.app':    { name: 'Railway',    cancelUrl: 'https://railway.app/account/billing',                     typicalAmount: 5,     typicalCurrency: 'USD' },
  'render.com':     { name: 'Render',     cancelUrl: 'https://dashboard.render.com/billing',                    typicalAmount: 7,     typicalCurrency: 'USD' },
  'supabase.com':   { name: 'Supabase',   cancelUrl: 'https://supabase.com/dashboard/account/billing',         typicalAmount: 25,    typicalCurrency: 'USD' },
  'supabase.io':    { name: 'Supabase',   cancelUrl: 'https://supabase.com/dashboard/account/billing',         typicalAmount: 25,    typicalCurrency: 'USD' },
  'neon.tech':      { name: 'Neon',       cancelUrl: 'https://console.neon.tech/app/settings/billing',         typicalAmount: 19,    typicalCurrency: 'USD' },
  'planetscale.com':{ name: 'PlanetScale',cancelUrl: 'https://app.planetscale.com/settings/billing',           typicalAmount: 29,    typicalCurrency: 'USD' },

  'audible.com':    { name: 'Audible',    cancelUrl: 'https://www.audible.com/account/overview',                typicalAmount: 14.95, typicalCurrency: 'USD' },
  'pandora.com':    { name: 'Pandora',    cancelUrl: 'https://www.pandora.com/account/overview',                typicalAmount: 4.99,  typicalCurrency: 'USD' },
  'soundcloud.com': { name: 'SoundCloud', cancelUrl: 'https://soundcloud.com/settings/subscriptions',           typicalAmount: 5.99,  typicalCurrency: 'USD' },

  'peloton.com':    { name: 'Peloton',    cancelUrl: 'https://www.onepeloton.com/membership',                   typicalAmount: 12.99, typicalCurrency: 'USD' },
  'noom.com':       { name: 'Noom',       cancelUrl: 'https://web.noom.com/subscription',                       typicalAmount: 70,    typicalCurrency: 'USD' },
  'headspace.com':  { name: 'Headspace',  cancelUrl: 'https://www.headspace.com/subscriptions',                 typicalAmount: 12.99, typicalCurrency: 'USD' },
  'calm.com':       { name: 'Calm',       cancelUrl: 'https://www.calm.com/settings',                           typicalAmount: 14.99, typicalCurrency: 'USD' },

  'instacart.com':  { name: 'Instacart+', cancelUrl: 'https://www.instacart.com/store/account',                 typicalAmount: 9.99,  typicalCurrency: 'USD' },
  'doordash.com':   { name: 'DashPass',   cancelUrl: 'https://www.doordash.com/consumer/subscriptions/',        typicalAmount: 9.99,  typicalCurrency: 'USD' },
  'hellofresh.com': { name: 'HelloFresh', cancelUrl: 'https://www.hellofresh.com/my-account/subscription',      typicalAmount: 59.94, typicalCurrency: 'USD' },

  'patreon.com':    { name: 'Patreon',    cancelUrl: 'https://www.patreon.com/settings/subscriptions',          typicalAmount: 5,     typicalCurrency: 'USD' },
  'substack.com':   { name: 'Substack',   cancelUrl: 'https://support.substack.com/hc/en-us/articles/360037465312', typicalAmount: 8,  typicalCurrency: 'USD' },
  'nytimes.com':    { name: 'NYT',        cancelUrl: 'https://myaccount.nytimes.com/seg/subscription',          typicalAmount: 17,    typicalCurrency: 'USD' },
  'wsj.com':        { name: 'WSJ',        cancelUrl: 'https://customercenter.wsj.com/account',                  typicalAmount: 38.99, typicalCurrency: 'USD' },
}

export function lookupKnownService(domain: string | null): KnownService | null {
  if (!domain) return null
  return KNOWN_SERVICES[domain.toLowerCase()] ?? null
}
