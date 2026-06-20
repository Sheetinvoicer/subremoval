import {defineRouting} from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'never'
})

export const rtlLocales = new Set(['ar'])
