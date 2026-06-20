'use client';

import { motion } from 'framer-motion';

export default function ModernCard({ title, value, icon, color, trend, onClick }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl bg-white dark:bg-gradient-to-br p-6 shadow-lg dark:shadow-2xl cursor-pointer group border border-gray-200 dark:border-white/10"
      style={!color?.includes('from') ? { backgroundColor: color } : {}}
    >
      <div className="relative z-10">
        <div className="text-4xl mb-3">{icon}</div>
        <div className="text-3xl font-bold text-gray-900 dark:text-white">{value}</div>
        <div className="text-gray-500 dark:text-white/80 text-sm mt-1">{title}</div>
        {trend && (
          <div className={`text-sm mt-2 ${trend >= 0 ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last month
          </div>
        )}
      </div>
    </motion.div>
  );
}
