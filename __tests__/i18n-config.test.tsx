import {render, screen} from '@testing-library/react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import {routing, rtlLocales} from '@/i18n/routing'

jest.mock('@/i18n/routing', () => ({
  routing: {
    locales: ['en', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ar'],
    defaultLocale: 'en'
  },
  rtlLocales: new Set(['ar'])
}))

jest.mock('next-intl', () => ({
  useLocale: () => 'en'
}))

const replace = jest.fn()
const refresh = jest.fn()

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({replace, refresh})
}))

describe('i18n routing configuration', () => {
  it('supports 8 locales including arabic', () => {
    expect(routing.locales).toHaveLength(8)
    expect(routing.locales).toEqual(expect.arrayContaining(['en', 'es', 'fr', 'de', 'it', 'pt', 'tr', 'ar']))
    expect(routing.defaultLocale).toBe('en')
  })

  it('marks arabic as rtl locale', () => {
    expect(rtlLocales.has('ar')).toBe(true)
    expect(rtlLocales.has('en')).toBe(false)
  })
})

describe('LanguageSwitcher', () => {
  it('renders locale options for all supported languages', () => {
    render(<LanguageSwitcher />)

    const select = screen.getByLabelText('Language')
    expect(select).toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(8)
  })
})
