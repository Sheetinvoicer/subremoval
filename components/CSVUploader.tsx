'use client'

import type { ChangeEvent } from 'react'
import { useState } from 'react'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'

type CsvRow = Record<string, string>

type Props = {
  onDataLoaded: (data: CsvRow[], fields?: string[]) => void
}

export default function CSVUploader({ onDataLoaded }: Props) {
  const t = useTranslations('csvUploader')
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          onDataLoaded(results.data, results.meta.fields)
          toast.success(t('loadedRows', { count: results.data.length }))
        } else {
          toast.error(t('noData'))
        }
        setLoading(false)
      },
      error: (error) => {
        toast.error(t('parseError', { message: error.message }))
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
          {fileName || t('clickToUpload')}
        </span>
        <span className="text-gray-500 text-sm">
          {t('supports')}
        </span>
        {loading && (
          <div className="mt-3 text-blue-500">{t('processing')}</div>
        )}
      </label>
    </div>
  )
}