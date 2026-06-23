'use client';
import React from 'react';

import { useState } from 'react';

export default function RemindersPage() {
  const [reminders, setReminders] = useState({
    overdue: true,
    due_soon: true,
    days_before: 3,
    weekly_summary: false
  });

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Payment Reminders</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Configure automatic reminders for your clients</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="text-gray-900 dark:text-white font-semibold">Send overdue reminders</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">Remind clients about overdue invoices</div>
          </div>
          <input
            type="checkbox"
            checked={reminders.overdue}
            onChange={(e) => setReminders({ ...reminders, overdue: e.target.checked })}
            className="w-5 h-5 accent-blue-600"
          />
        </div>

        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="text-gray-900 dark:text-white font-semibold">Send due soon reminders</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">Remind clients before invoice due date</div>
          </div>
          <input
            type="checkbox"
            checked={reminders.due_soon}
            onChange={(e) => setReminders({ ...reminders, due_soon: e.target.checked })}
            className="w-5 h-5 accent-blue-600"
          />
        </div>

        {reminders.due_soon && (
          <div className="p-6">
            <label className="block text-gray-900 dark:text-white font-semibold mb-2">Remind X days before due date</label>
            <input
              type="number"
              value={reminders.days_before}
              onChange={(e) => setReminders({ ...reminders, days_before: parseInt(e.target.value) })}
              min="1"
              max="30"
              className="w-32 p-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600"
            />
          </div>
        )}

        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="text-gray-900 dark:text-white font-semibold">Weekly summary email</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">Receive a weekly summary of unpaid invoices</div>
          </div>
          <input
            type="checkbox"
            checked={reminders.weekly_summary}
            onChange={(e) => setReminders({ ...reminders, weekly_summary: e.target.checked })}
            className="w-5 h-5 accent-blue-600"
          />
        </div>
      </div>

      <button
        onClick={() => alert('Reminder settings saved!')}
        className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all"
      >
        Save Reminder Settings
      </button>
    </div>
  );
}
