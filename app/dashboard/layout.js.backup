import Sidebar from '@/components/Sidebar'
import { Toaster } from 'react-hot-toast'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-auto">
        <Toaster position="top-right" />
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
