'use client'

import { useState, useEffect } from 'react'

export default function ColumnMapper({ columns, sampleData, onMappingComplete }) {
  const [mapping, setMapping] = useState({
    name: '',
    email: '',
    amount: '',
    description: ''
  })

  useEffect(() => {
    const autoMap = {
      name: columns.find(col => /name|customer|client/i.test(col)) || '',
      email: columns.find(col => /email|e-?mail/i.test(col)) || '',
      amount: columns.find(col => /amount|total|price|value/i.test(col)) || '',
      description: columns.find(col => /desc|item|product|service/i.test(col)) || ''
    }
    setMapping(autoMap)
  }, [columns])

  const handleMappingChange = (field, value) => {
    const newMapping = { ...mapping, [field]: value }
    setMapping(newMapping)
    
    if (newMapping.name && newMapping.email && newMapping.amount) {
      onMappingComplete(newMapping)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Map CSV Columns</h3>
      <p className="text-gray-600 text-sm mb-4">
        Match your CSV columns to invoice fields
      </p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client Name <span className="text-red-500">*</span>
          </label>
          <select
            value={mapping.name}
            onChange={(e) => handleMappingChange('name', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">Select column...</option>
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client Email <span className="text-red-500">*</span>
          </label>
          <select
            value={mapping.email}
            onChange={(e) => handleMappingChange('email', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">Select column...</option>
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount <span className="text-red-500">*</span>
          </label>
          <select
            value={mapping.amount}
            onChange={(e) => handleMappingChange('amount', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">Select column...</option>
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <select
            value={mapping.description}
            onChange={(e) => handleMappingChange('description', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">Select column...</option>
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}