'use client';

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (path) => {
    setOpen(false);
    setQuery('');
    router.push(path);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="Open search"
      >
        <Search size={16} />
        <span className="hidden md:inline">Search...</span>
        <kbd className="text-xs text-gray-400">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
          <Search size={18} className="ml-4 text-gray-400" />
          <input
            id="search-input"
            name="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoices, clients, expenses..."
            className="flex-1 px-4 py-3 text-gray-900 dark:text-gray-100 bg-transparent outline-none"
            autoFocus
            autoComplete="off"
          />
          <button onClick={() => setOpen(false)} className="mr-4 text-gray-400" aria-label="Close search">
            <X size={18} />
          </button>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
          {(query === '' || query.toLowerCase().includes('invoice')) && (
            <button
              onClick={() => handleSelect('/dashboard/invoices')}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <span>📄</span> Invoices
            </button>
          )}
          {(query === '' || query.toLowerCase().includes('client')) && (
            <button
              onClick={() => handleSelect('/dashboard/clients')}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <span>👥</span> Clients
            </button>
          )}
          {(query === '' || query.toLowerCase().includes('expense')) && (
            <button
              onClick={() => handleSelect('/dashboard/expenses')}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <span>💰</span> Expenses
            </button>
          )}
          {(query === '' || query.toLowerCase().includes('setting')) && (
            <button
              onClick={() => handleSelect('/dashboard/settings')}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <span>⚙️</span> Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
