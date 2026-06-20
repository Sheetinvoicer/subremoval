'use client';

import { motion } from 'framer-motion';

export default function ModernButton({ children, onClick, variant = 'primary', icon, disabled }) {
  const variants = {
    primary: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white',
    secondary: 'bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white border border-gray-300 dark:border-white/20 hover:bg-gray-300 dark:hover:bg-white/20',
    danger: 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white',
    success: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium shadow-lg transition-all ${variants[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon && <span>{icon}</span>}
      {children}
    </motion.button>
  );
}
