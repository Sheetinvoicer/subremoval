"use client";


import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast, { Toaster } from 'react-hot-toast'
import Footer from '@/components/Footer'
// import posthog from 'posthog-js'
import Logo from '@/components/Logo'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!supabase) {
      toast.error('Failed to initialize authentication')
      return
    }
    
    if (!acceptedTerms) {
      toast.error('You must accept the Terms of Service and Privacy Policy')
      return
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      // posthog.capture('user_signed_up', { email, has_name: !!name })
      toast.success('Check your email for confirmation link!')
      setTimeout(() => router.push('/login'), 3000)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Toaster position="top-right" />
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          
          <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">Create Account</h1>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-6">Start invoicing in minutes</p>
          
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <input
                id="full-name"
                name="fullName"
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                  text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                  text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                  text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl 
                  text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                required
              />
            </div>
            
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                checked={acceptedTerms}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setAcceptedTerms(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-400">
                I agree to the{' '}
                <Link href="/terms" className="text-blue-600 hover:underline" target="_blank">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-blue-600 hover:underline" target="_blank">
                  Privacy Policy
                </Link>
              </label>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium 
                hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>
          
          <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      
      <Footer />
    </div>
  )
}
