'use client';

import { useState } from 'react';
import { Client } from './ClientList';

interface ClientDetailsProps {
  client: Client;
  onClose: () => void;
}

export default function ClientDetails({ client, onClose }: ClientDetailsProps) {
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runAIAnalysis = async () => {
    setLoading(true);
    setTimeout(() => {
      setAiAnalysis({
        paymentBehavior: 'Good',
        riskScore: Math.floor(Math.random() * 100),
        nextBestAction: 'Send loyalty discount',
        predictedValue: '$15,000',
        insights: ['Regular payment history', 'Good credit potential', 'Recommend upsell']
      });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold">Client Details</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      
      <div className="space-y-3">
        <p><strong>Name:</strong> {client.name}</p>
        <p><strong>Company:</strong> {client.company}</p>
        <p><strong>Email:</strong> {client.email}</p>
        <p><strong>Phone:</strong> {client.phone}</p>
        <p><strong>Address:</strong> {client.address}</p>
        <p><strong>Balance:</strong> ${client.balance?.toLocaleString()}</p>
        <p><strong>Credit Limit:</strong> ${client.creditLimit?.toLocaleString()}</p>
        <p><strong>Status:</strong> 
          <span className={`ml-2 px-2 py-1 text-xs rounded ${
            client.status === 'active' ? 'bg-green-100 text-green-800' :
            client.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
            'bg-red-100 text-red-800'
          }`}>
            {client.status}
          </span>
        </p>
        
        <button
          onClick={runAIAnalysis}
          disabled={loading}
          className="w-full mt-4 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'AI Analyzing...' : 'Run AI Analysis'}
        </button>
        
        {aiAnalysis && (
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <h3 className="font-bold mb-2">AI Analysis Results</h3>
            <p>Risk Score: {aiAnalysis.riskScore}/100</p>
            <p>Payment Behavior: {aiAnalysis.paymentBehavior}</p>
            <p>Next Best Action: {aiAnalysis.nextBestAction}</p>
            <p>Predicted Lifetime Value: {aiAnalysis.predictedValue}</p>
          </div>
        )}
      </div>
    </div>
  );
}
