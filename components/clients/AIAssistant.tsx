'use client';

import { useState } from 'react';

interface AIAssistantProps {
  client?: any;
  onSuggestion?: (suggestion: any) => void;
}

export default function AIAssistant({ client, onSuggestion }: AIAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);

  const getAISuggestions = async () => {
    setLoading(true);
    // Simulate AI analysis
    setTimeout(() => {
      const aiSuggestions = {
        creditScore: Math.floor(Math.random() * 30) + 70,
        riskLevel: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
        recommendations: [
          'Offer early payment discount',
          'Schedule follow-up in 2 weeks',
          'Consider increasing credit limit'
        ],
        nextBestAction: 'Send personalized offer'
      };
      setSuggestions(aiSuggestions);
      if (onSuggestion) onSuggestion(aiSuggestions);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-purple-800">🤖 AI Assistant</h3>
        <button
          onClick={getAISuggestions}
          disabled={loading}
          className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'Thinking...' : 'Get Insights'}
        </button>
      </div>
      
      {suggestions && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Credit Score:</span>
            <span className="font-bold">{suggestions.creditScore}/100</span>
          </div>
          <div className="flex justify-between">
            <span>Risk Level:</span>
            <span className={`font-bold ${
              suggestions.riskLevel === 'Low' ? 'text-green-600' :
              suggestions.riskLevel === 'Medium' ? 'text-yellow-600' : 'text-red-600'
            }`}>{suggestions.riskLevel}</span>
          </div>
          <div className="mt-2">
            <span className="font-bold">Recommendations:</span>
            <ul className="list-disc list-inside mt-1 space-y-1">
              {suggestions.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-gray-700">{rec}</li>
              ))}
            </ul>
          </div>
          <div className="mt-2 pt-2 border-t border-purple-200">
            <span className="font-bold">Next Best Action:</span>
            <p className="text-purple-700 mt-1">{suggestions.nextBestAction}</p>
          </div>
        </div>
      )}
      
      {!suggestions && !loading && (
        <p className="text-gray-500 text-sm text-center">
          Click "Get Insights" for AI-powered recommendations
        </p>
      )}
    </div>
  );
}
