"use client";
"use client";


import { useState, useEffect } from 'react'

export default function ApiDocsPage() {
  const [spec, setSpec] = useState(null)

  useEffect(() => {
    fetch('/api/swagger.json').then(res => res.json()).then(setSpec)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="bg-blue-600 text-white p-4 rounded-lg mb-6">
        <h1 className="text-2xl font-bold">SubRemoval API Documentation</h1>
        <p className="text-sm opacity-90">REST API for developers</p>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Authentication</h2>
        <p>Use your Supabase JWT token in the Authorization header:</p>
        <pre className="bg-gray-100 p-3 rounded mt-2">Authorization: Bearer YOUR_JWT_TOKEN</pre>
        
        <h2 className="text-xl font-bold mt-6 mb-4">Endpoints</h2>
        
        <div className="border rounded-lg mb-4">
          <div className="bg-green-500 text-white px-3 py-1 rounded-t inline-block">GET</div>
          <div className="p-4">
            <code className="font-mono">/api/invoices</code>
            <p className="text-gray-600 mt-2">Get all invoices for the authenticated user</p>
          </div>
        </div>
        
        <div className="border rounded-lg mb-4">
          <div className="bg-blue-500 text-white px-3 py-1 rounded-t inline-block">POST</div>
          <div className="p-4">
            <code className="font-mono">/api/invoices</code>
            <p className="text-gray-600 mt-2">Create a new invoice</p>
            <pre className="bg-gray-100 p-3 rounded mt-2">
{`{
  "client_id": "uuid",
  "amount": 100.00,
  "due_date": "2024-12-31"
}`}
            </pre>
          </div>
        </div>
        
        <div className="border rounded-lg mb-4">
          <div className="bg-green-500 text-white px-3 py-1 rounded-t inline-block">GET</div>
          <div className="p-4">
            <code className="font-mono">/api/clients</code>
            <p className="text-gray-600 mt-2">Get all clients</p>
          </div>
        </div>
        
        <div className="border rounded-lg mb-4">
          <div className="bg-green-500 text-white px-3 py-1 rounded-t inline-block">GET</div>
          <div className="p-4">
            <code className="font-mono">/api/expenses</code>
            <p className="text-gray-600 mt-2">Get all expenses</p>
          </div>
        </div>
      </div>
    </div>
  )
}
