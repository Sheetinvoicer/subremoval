'use client';
import React from 'react';

import { motion } from 'framer-motion';

export default function ModernCard({ title, value, icon, color, trend, onClick }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-card bg-card/70 backdrop-blur-md p-6 shadow-card hover:shadow-glow cursor-pointer group border border-border hover:border-accent/60 transition-colors"
      style={color && !color?.includes('from') ? { backgroundColor: color } : {}}
    >
      <div className="relative z-10">
        <div className="text-4xl mb-3">{icon}</div>
        <div className="text-3xl font-bold text-text-primary">{value}</div>
        <div className="text-text-secondary text-sm mt-1">{title}</div>
        {trend && (
          <div className={`text-sm mt-2 ${trend >= 0 ? 'text-success' : 'text-red-400'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last month
          </div>
        )}
      </div>
    </motion.div>
  );
}
