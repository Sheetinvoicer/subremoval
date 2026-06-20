'use client'

import Link from 'next/link'

export default function EmptyState({ 
  title, 
  description, 
  icon, 
  actionText, 
  actionLink, 
  actionType = "primary" 
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full mb-6">
        <span className="text-4xl">{icon}</span>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
        {description}
      </p>
      {actionText && actionLink && (
        <Link
          href={actionLink}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            actionType === "primary"
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white"
          }`}
        >
          {actionText}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  )
}
