'use client'

import { useState } from 'react'
import Button from './Button'

export default function InvoiceFilters({ onFilterChange, onSortChange, onSearch }) {
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: ''
  })
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [searchTerm, setSearchTerm] = useState('')

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleSortChange = (field) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc'
    setSortBy(field)
    setSortOrder(newOrder)
    onSortChange({ field, order: newOrder })
  }

  const handleSearch = () => {
    onSearch(searchTerm)
  }

  const clearAllFilters = () => {
    const emptyFilters = {
      status: '',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: ''
    }
    setFilters(emptyFilters)
    setSearchTerm('')
    setSortBy('created_at')
    setSortOrder('desc')
    onFilterChange(emptyFilters)
    onSearch('')
    onSortChange({ field: 'created_at', order: 'desc' })
  }

  return (
    <div className="bg-white rounded-lg shadow mb-6 p-4">
      {/* Search Bar */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search invoices by number, client, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 p-2 border border-gray-300 rounded-lg text-gray-900"
          />
          <Button onClick={handleSearch} variant="primary" size="sm">
            🔍 Search
          </Button>
        </div>
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="p-2 border border-gray-300 rounded-lg text-gray-900"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>

        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          placeholder="From Date"
          className="p-2 border border-gray-300 rounded-lg text-gray-900"
        />

        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          placeholder="To Date"
          className="p-2 border border-gray-300 rounded-lg text-gray-900"
        />

        <input
          type="number"
          placeholder="Min Amount"
          value={filters.minAmount}
          onChange={(e) => handleFilterChange('minAmount', e.target.value)}
          className="p-2 border border-gray-300 rounded-lg text-gray-900"
        />

        <input
          type="number"
          placeholder="Max Amount"
          value={filters.maxAmount}
          onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
          className="p-2 border border-gray-300 rounded-lg text-gray-900"
        />
      </div>

      {/* Sort Buttons */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-600">Sort by:</span>
          <button
            onClick={() => handleSortChange('invoice_number')}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === 'invoice_number' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Invoice #{sortBy === 'invoice_number' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSortChange('total')}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === 'total' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Amount {sortBy === 'total' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSortChange('created_at')}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === 'created_at' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Date {sortBy === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => handleSortChange('status')}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === 'status' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
        
        <Button onClick={clearAllFilters} variant="secondary" size="sm">
          Clear All Filters
        </Button>
      </div>
    </div>
  )
}
