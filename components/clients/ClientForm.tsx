'use client';

import { useState, useEffect } from 'react';
import { Client } from './ClientList';

interface ClientFormProps {
  client?: Client | null;
  onSave: (client: any) => void;
  onClose: () => void;
}

export default function ClientForm({ client, onSave, onClose }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    taxId: '',
    paymentTerms: 'Net 30',
    creditLimit: 5000,
    notes: ''
  });

  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone,
        company: client.company,
        address: client.address,
        taxId: client.taxId || '',
        paymentTerms: client.paymentTerms,
        creditLimit: client.creditLimit,
        notes: client.notes || ''
      });
    }
  }, [client]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const enhanceWithAI = async () => {
    setAiEnhancing(true);
    setTimeout(() => {
      setAiSuggestion({
        creditScore: Math.floor(Math.random() * 30) + 70,
        suggestedCreditLimit: formData.creditLimit + 2000,
        riskLevel: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
        recommendation: 'Based on company profile, consider premium support'
      });
      setAiEnhancing(false);
    }, 1500);
  };

  const applySuggestion = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    setAiSuggestion(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{client ? 'Edit Client' : 'Add New Client'}</h2>
          <button
            onClick={enhanceWithAI}
            disabled={aiEnhancing}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {aiEnhancing ? 'AI Thinking...' : '✨ AI Enhance'}
          </button>
        </div>

        {aiSuggestion && (
          <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="font-bold text-purple-800">🤖 AI Insights</h3>
            <p>Credit Score: {aiSuggestion.creditScore}/100</p>
            <p>Risk Level: {aiSuggestion.riskLevel}</p>
            <div className="flex justify-between items-center mt-2">
              <span>Suggested Credit: ${aiSuggestion.suggestedCreditLimit}</span>
              <button 
                onClick={() => applySuggestion('creditLimit', aiSuggestion.suggestedCreditLimit)} 
                className="text-purple-600 underline"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Company</label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Terms</label>
              <select
                name="paymentTerms"
                value={formData.paymentTerms}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Net 45</option>
                <option>Net 60</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Credit Limit</label>
              <input
                type="number"
                name="creditLimit"
                value={formData.creditLimit}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {client ? 'Update Client' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
