'use client';

import { useState } from 'react';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  taxId?: string;
  paymentTerms: string;
  creditLimit: number;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  status: 'active' | 'inactive' | 'blocked';
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ClientListProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onSelect: (client: Client) => void;
}

export default function ClientList({ clients, onEdit, onDelete, onSelect }: ClientListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          client.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || client.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2 border rounded"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      <div className="divide-y">
        {filteredClients.map((client) => (
          <div key={client.id} className="p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start">
              <div className="flex-1 cursor-pointer" onClick={() => onSelect(client)}>
                <h3 className="font-semibold text-lg">{client.name}</h3>
                <p className="text-sm text-gray-600">{client.company}</p>
                <p className="text-sm text-gray-500">{client.email}</p>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    client.status === 'active' ? 'bg-green-100 text-green-800' :
                    client.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {client.status}
                  </span>
                  <span className="text-sm">Balance: ${client.balance?.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onEdit(client)} className="text-blue-500 hover:text-blue-700">
                  Edit
                </button>
                <button onClick={() => onDelete(client.id)} className="text-red-500 hover:text-red-700">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
