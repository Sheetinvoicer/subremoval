'use client';

import { useState, useEffect } from 'react';
import ClientList, { Client } from '@/components/clients/ClientList';
import ClientForm from '@/components/clients/ClientForm';
import ClientDetails from '@/components/clients/ClientDetails';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => {
    const savedClients = localStorage.getItem('clients');
    if (savedClients) {
      setClients(JSON.parse(savedClients));
    }
  }, []);

  const saveClients = (updatedClients: Client[]) => {
    setClients(updatedClients);
    localStorage.setItem('clients', JSON.stringify(updatedClients));
  };

  const handleAddClient = (clientData: any) => {
    const newClient: Client = {
      ...clientData,
      id: Date.now().toString(),
      totalInvoiced: 0,
      totalPaid: 0,
      balance: 0,
      status: 'active',
      tags: [],
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    saveClients([...clients, newClient]);
    setShowForm(false);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleUpdateClient = (updatedData: any) => {
    if (!editingClient) return;
    const updatedClients = clients.map(client => 
      client.id === editingClient.id 
        ? { ...updatedData, id: client.id, updatedAt: new Date() }
        : client
    );
    saveClients(updatedClients);
    setShowForm(false);
    setEditingClient(null);
  };

  const handleDeleteClient = (clientId: string) => {
    if (confirm('Are you sure? This will affect all invoices.')) {
      const updatedClients = clients.filter(c => c.id !== clientId);
      saveClients(updatedClients);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Client Management</h1>
        <button
          onClick={() => {
            setEditingClient(null);
            setShowForm(true);
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add New Client
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ClientList 
            clients={clients}
            onEdit={handleEditClient}
            onDelete={handleDeleteClient}
            onSelect={setSelectedClient}
          />
        </div>
        <div>
          {selectedClient && (
            <ClientDetails 
              client={selectedClient}
              onClose={() => setSelectedClient(null)}
            />
          )}
        </div>
      </div>

      {showForm && (
        <ClientForm
          client={editingClient}
          onSave={editingClient ? handleUpdateClient : handleAddClient}
          onClose={() => {
            setShowForm(false);
            setEditingClient(null);
          }}
        />
      )}
    </div>
  );
}
