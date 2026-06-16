'use client';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import components with no SSR
const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false });
const SearchBar = dynamic(() => import('@/components/SearchBar'), { ssr: false });
const AIAssistant = dynamic(() => import('@/components/AIAssistant'), { ssr: false });

export default function DashboardLayout({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <div className="flex-1">
          <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="flex justify-end items-center px-6 py-3">
              <div className="w-48 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            </div>
          </div>
          <main className="p-4 md:p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <Sidebar />
      <div className="flex-1">
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="flex justify-end items-center px-6 py-3">
            <SearchBar />
          </div>
        </div>
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}
