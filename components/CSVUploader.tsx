'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import toast from 'react-hot-toast'

export default function CSVUploader({ onDataLoaded }) {
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          onDataLoaded(results.data, results.meta.fields)
          toast.success(`Loaded ${results.data.length} rows`)
        } else {
          toast.error('No data found in CSV')
        }
        setLoading(false)
      },
      error: (error) => {
        toast.error('Error parsing CSV: ' + error.message)
        setLoading(false)
      }
    })
  }

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
        id="csv-upload"
      />
      <label
        htmlFor="csv-upload"
        className="cursor-pointer inline-flex flex-col items-center"
      >
        <span className="text-5xl mb-3">📊</span>
        <span className="text-gray-700 font-medium mb-1">
          {fileName || 'Click to upload CSV file'}
        </span>
        <span className="text-gray-500 text-sm">
          Supports .csv files with headers
        </span>
        {loading && (
          <div className="mt-3 text-blue-500">Processing...</div>
        )}
      </label>
    </div>
  )
}