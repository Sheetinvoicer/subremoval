'use client'

export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
        <span className="text-white text-sm font-bold">SI</span>
      </div>
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">SheetInvoicer</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">Professional Invoicing</p>
      </div>
    </div>
  )
}
