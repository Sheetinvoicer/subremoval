"use client";


import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import Footer from '@/components/Footer'
import Logo from '@/components/Logo'
import { useTranslations } from 'next-intl'

export default function LoginPage() {
  const t = useTranslations('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [rememberDevice, setRememberDevice] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!supabase) {
      toast.error(t('errors.initAuth'))
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      const twoFactorEnabled = Boolean(data.user?.user_metadata?.two_factor?.enabled)
      if (twoFactorEnabled) {
        const statusResponse = await fetch('/api/auth/2fa?action=status')
        const statusData = await statusResponse.json()

        if (statusData.rememberTrusted) {
          toast.success(t('messages.welcomeBack'))
          router.push('/dashboard')
          router.refresh()
          return
        }

        setRequiresTwoFactor(true)
        toast.success(t('messages.enter2fa'))
        return
      }

      toast.success(t('messages.welcomeBack'))
      router.push('/dashboard')
      router.refresh()
    }
  }

  const handleTwoFactorVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const response = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify-login',
        code: twoFactorCode,
        rememberDevice,
      }),
    })

    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      toast.error(data.error || t('errors.invalidCode'))
      return
    }

    toast.success(t('messages.welcomeBack'))
    router.push('/dashboard')
    router.refresh()
  }

  const handleGoogleLogin = async () => {
    if (!supabase) {
      toast.error(t('errors.initAuth'))
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) toast.error(error.message)
  }

  const handleMicrosoftLogin = async () => {
    if (!supabase) {
      toast.error(t('errors.initAuth'))
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email',
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) toast.error(error.message)
  }

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setResetLoading(true)
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail }),
    })
    const data = await response.json()
    setResetLoading(false)
    if (data.success) {
      toast.success(t('messages.resetEmailSent'))
      setShowForgot(false)
    } else {
      toast.error(data.error || t('errors.resetEmailFailed'))
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-gray-900 dark:to-gray-800">
      <Toaster position="top-right" />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md">
          {/* Logo at the top */}
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          
          {!showForgot ? (
            <>
              <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">{t('title')}</h1>
              <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
                {requiresTwoFactor ? t('subtitle2fa') : t('subtitle')}
              </p>
              
              {!requiresTwoFactor ? (
                <>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <input
                        type="email"
                        placeholder={t('fields.email')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                          text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                    </div>
                    
                    <div>
                      <input
                        type="password"
                        placeholder={t('fields.password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                          text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                    </div>
                    
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('actions.forgotPassword')}
                      </button>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium 
                        hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                      {loading ? t('actions.signingIn') : t('actions.signIn')}
                    </button>
                  </form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {t('actions.orContinueWith')}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 
                      border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 
                      py-2.5 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {t('actions.signInWithGoogle')}
                  </button>

                  <button
                    onClick={handleMicrosoftLogin}
                    className="w-full mt-3 flex items-center justify-center gap-3 bg-white dark:bg-gray-700 
                      border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 
                      py-2.5 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 23 23">
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#7fba00" d="M12 1h10v10H12z" />
                      <path fill="#00a4ef" d="M1 12h10v10H1z" />
                      <path fill="#ffb900" d="M12 12h10v10H12z" />
                    </svg>
                    {t('actions.signInWithMicrosoft')}
                  </button>
                </>
              ) : (
                <form onSubmit={handleTwoFactorVerify} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      placeholder={t('fields.authenticatorCode')}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                        text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                    />
                    {t('actions.rememberDevice')}
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium 
                      hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    {loading ? t('actions.verifying') : t('actions.verifyContinue')}
                  </button>
                </form>
              )}
              
              <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
                {t('footer.noAccount')}{' '}
                <Link href="/signup" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  {t('footer.signUp')}
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">{t('reset.title')}</h1>
              <p className="text-center text-gray-500 dark:text-gray-400 mb-6">{t('reset.subtitle')}</p>
              
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <input
                    type="email"
                    placeholder={t('fields.email')}
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                      text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium 
                    hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {resetLoading ? t('reset.sending') : t('reset.sendLink')}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="w-full text-gray-600 dark:text-gray-400 py-2 text-sm hover:underline"
                >
                  {t('reset.backToSignIn')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      
      <Footer />
    </div>
  )
}
