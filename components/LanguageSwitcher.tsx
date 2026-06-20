'use client'

import {useTransition} from 'react'
import {useLocale} from 'next-intl'
import {usePathname, useRouter} from 'next/navigation'
import {routing} from '@/i18n/routing'

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
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200/60 dark:border-gray-700/70 p-2">
      <label htmlFor="language-switcher" className="text-xs font-medium text-gray-600 dark:text-gray-300">
        Language
      </label>
      <select
        id="language-switcher"
        className="flex-1 bg-transparent text-sm outline-none"
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const nextLocale = event.target.value

          startTransition(async () => {
            await fetch('/api/locale', {
              method: 'POST',
              headers: {'content-type': 'application/json'},
              body: JSON.stringify({locale: nextLocale})
            })

            router.replace(pathname)
            router.refresh()
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
