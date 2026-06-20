'use client'

import { useState } from 'react'

export default function InvoiceFilter({ onFilter }) {
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: ''
  })

  const handleChange = (field, value) => {
    const newFilters = { ...filters, [field]: value }
    setFilters(newFilters)
    onFilter(newFilters)
  }

  const handleReset = () => {
    const resetFilters = { status: '', dateFrom: '', dateTo: '', minAmount: '', maxAmount: '' }
    setFilters(resetFilters)
    onFilter(resetFilters)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <select
          value={filters.status}
          onChange={(e) => handleChange('status', e.target.value)}
          className="p-2 border border-gray-300 rounded-lg text-gray-900"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
        </select>

        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handleChange('dateFrom', e.target.value)}
          placeholder="From Date"
          className="p-2 border border-gray-300 rounded-lg text-gray-900"
        />

        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => handleChange('dateTo', e.target.value)}
          placeholder="To Date"
          className="p-2 border border-gray-300 rounded-lg text-gray-900"
        />

        <input
          type="number"
          value={filters.minAmount}
          onChange={(e) => handleChange('minAmount', e.target.value)}
          placeholder="Min Amount"
          className="p-2 border border-gray-300 rounded-lg text-gray-900"
        />

        <div className="flex space-x-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
