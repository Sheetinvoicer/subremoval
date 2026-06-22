'use client'

import {useEffect, useTransition} from 'react'
import {useLocale, useTranslations} from 'next-intl'
import {usePathname, useRouter} from 'next/navigation'
import {routing, rtlLocales} from '@/i18n/routing'

const LOCALE_STORAGE_KEY = 'sheetinvoicer_locale'
const LEGACY_LOCALE_STORAGE_KEY = 'app-language'

const languageLabels: Record<(typeof routing.locales)[number], string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  tr: 'Türkçe',
  ar: 'العربية'
}

export default function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.lang = locale
    document.documentElement.dir = rtlLocales.has(locale) ? 'rtl' : 'ltr'
  }, [locale])

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200/60 dark:border-gray-700/70 p-2">
      <label htmlFor="language-switcher" className="text-xs font-medium text-gray-600 dark:text-gray-300">
        {t('label')}
      </label>
      <select
        id="language-switcher"
        name="language"
        className="flex-1 bg-transparent text-sm outline-none"
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const nextLocale = event.target.value

          startTransition(async () => {
            const response = await fetch('/api/locale', {
              method: 'POST',
              headers: {'content-type': 'application/json'},
              body: JSON.stringify({locale: nextLocale})
            })

            if (!response.ok) {
              return
            }

            localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale)
            localStorage.setItem(LEGACY_LOCALE_STORAGE_KEY, nextLocale)
            document.documentElement.lang = nextLocale
            document.documentElement.dir = rtlLocales.has(nextLocale) ? 'rtl' : 'ltr'

            router.replace(pathname)
            window.location.reload()
          })
        }}
      >
        {routing.locales.map((value) => (
          <option key={value} value={value}>
            {languageLabels[value]}
          </option>
        ))}
      </select>
    </div>
  )
}
