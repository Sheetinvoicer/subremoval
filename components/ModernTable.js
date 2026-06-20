'use client';

import { motion } from 'framer-motion';

export default function ModernTable({ headers, data, onRowClick, actions }) {
  return (
    <div className="rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-white/10 border-b border-gray-200 dark:border-white/10">
            <tr>
              {headers.map((header, idx) => (
                <th key={idx} className="px-6 py-4 text-left text-gray-700 dark:text-white font-semibold">
                  {header}
                </th>
              ))}
              {actions && <th className="px-6 py-4 text-right text-gray-700 dark:text-white">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <motion.tr
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => onRowClick?.(row)}
                className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                {Object.values(row).map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-6 py-4 text-gray-600 dark:text-white/80">
                    {cell}
                  </td>
                ))}
                {actions && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      {actions.map((action, actionIdx) => (
                        <button
                          key={actionIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(row);
                          }}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-all text-gray-700 dark:text-white"
                        >
                          {action.icon}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
