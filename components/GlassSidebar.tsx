'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Menu, X, Sparkles, ChevronRight } from 'lucide-react'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊', tutorial: 'View your business overview and key metrics' },
  { name: 'Invoices', href: '/dashboard/invoices', icon: '📄', tutorial: 'Create and manage professional invoices' },
  { name: 'Clients', href: '/dashboard/clients', icon: '👥', tutorial: 'Manage your client database' },
  { name: 'Expenses', href: '/dashboard/expenses', icon: '💰', tutorial: 'Track business expenses' },
  { name: 'Estimates', href: '/dashboard/estimates', icon: '📋', tutorial: 'Create estimates that convert' },
  { name: 'Recurring', href: '/dashboard/recurring', icon: '🔄', tutorial: 'Set up automatic invoices' },
  { name: 'Reports', href: '/dashboard/reports', icon: '📈', tutorial: 'Analyze your business performance' },
  { name: 'Settings', href: '/dashboard/settings', icon: '⚙️', tutorial: 'Configure your account settings' },
]

// Memoized nav item for performance
const NavItem = memo(({ item, isActive, onClick, showTooltip, onTooltipNext }) => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className="relative group">
      <Link href={item.href} onClick={onClick} prefetch={true}>
        <motion.div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          whileHover={{ x: 8, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          animate={{
            backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
        >
          <motion.span 
            className="text-xl"
            animate={{ scale: isHovered ? 1.1 : 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            {item.icon}
          </motion.span>
          <span className="text-sm font-medium">{item.name}</span>
          {isActive && (
            <motion.div
              layoutId="activeIndicator"
              className="ml-auto w-1 h-6 bg-blue-500 rounded-full"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          {isHovered && !isActive && (
            <ChevronRight size={14} className="ml-auto text-gray-400" />
          )}
        </motion.div>
      </Link>

      {/* Tutorial Tooltip */}
      {showTooltip && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-64 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 rounded-xl shadow-2xl z-50"
        >
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs mt-1 opacity-90">{item.tutorial}</p>
              <button
                onClick={onTooltipNext}
                className="mt-2 text-xs bg-white/20 px-3 py-1 rounded-lg hover:bg-white/30 transition-colors"
              >
                Next Tip →
              </button>
            </div>
          </div>
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-blue-600 rotate-45" />
        </motion.div>
      )}
    </div>
  )
})

NavItem.displayName = 'NavItem'

export default function GlassSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [isClient, setIsClient] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Fix hydration mismatch - set isClient to true after mount
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Spring animation for smooth sidebar motion
  const sidebarX = useMotionValue(isOpen ? 0 : -280)
  const springX = useSpring(sidebarX, { stiffness: 300, damping: 30 })

  useEffect(() => {
    sidebarX.set(isOpen ? 0 : -280)
  }, [isOpen, sidebarX])

  // Check if user is new (first time) - with localStorage guard
  useEffect(() => {
    if (isClient && user) {
      const hasSeenTutorial = typeof localStorage !== 'undefined' ? localStorage.getItem('sidebar-tutorial-seen') : null
      if (!hasSeenTutorial) {
        setTimeout(() => setShowTutorial(true), 1500)
      }
    }
  }, [user, isClient])

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleNavClick = () => {
    // Guard for window object to prevent hydration mismatch
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsOpen(false)
    }
  }

  const nextTutorial = () => {
    if (tutorialStep + 1 >= navItems.length) {
      setShowTutorial(false)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sidebar-tutorial-seen', 'true')
      }
    } else {
      setTutorialStep(tutorialStep + 1)
    }
  }

  const skipTutorial = () => {
    setShowTutorial(false)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sidebar-tutorial-seen', 'true')
    }
  }

  // Don't render until client-side to prevent hydration mismatch
  if (!isClient) {
    return null
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-2 rounded-lg shadow-lg"
        aria-label="Menu"
      >
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </motion.div>
      </motion.button>

      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        style={{ x: springX }}
        className="fixed left-0 top-0 z-40 h-screen w-72 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-r border-white/20 dark:border-gray-700/50 shadow-2xl lg:translate-x-0"
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-5 border-b border-gray-200/50 dark:border-gray-700/50"
          >
            <Link href="/dashboard">
              <motion.h1 
                whileHover={{ scale: 1.02 }}
                className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
              >
                SheetInvoicer
              </motion.h1>
            </Link>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-gray-500 mt-1 flex items-center gap-1"
            >
              <Sparkles size={12} className="text-yellow-500" />
              Global Invoicing Platform
            </motion.p>
          </motion.div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <NavItem 
                  item={item} 
                  isActive={pathname === item.href || pathname?.startsWith(item.href + '/')}
                  onClick={handleNavClick}
                  showTooltip={showTutorial && tutorialStep === index}
                  onTooltipNext={nextTutorial}
                />
              </motion.div>
            ))}
          </nav>

          {/* Footer */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-3 overflow-visible"
          >
            <LanguageSwitcher />
            
            {user && (
              <motion.div 
                whileHover={{ x: 5 }}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20"
              >
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">✓ Active Account</p>
              </motion.div>
            )}
            
            <motion.button
              whileHover={{ x: 5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left text-red-600 hover:bg-red-50/50 dark:hover:bg-red-900/30 transition-all"
            >
              <span className="text-xl">🚪</span>
              <span className="text-sm font-medium">Logout</span>
            </motion.button>
          </motion.div>
        </div>
      </motion.aside>

      {/* Tutorial Skip Button */}
      {showTutorial && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={skipTutorial}
          className="fixed bottom-4 right-4 z-50 text-xs text-gray-500 bg-white/80 dark:bg-gray-800/80 px-3 py-1.5 rounded-full shadow-lg"
        >
          Skip Tutorial
        </motion.button>
      )}

      {/* Push main content */}
      <div className="lg:ml-72" />
    </>
  )
}