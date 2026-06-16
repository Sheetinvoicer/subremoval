'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function EditExpensePage({ params }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenseId, setExpenseId] = useState(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadExpense() {
      const { id } = await params;
      setExpenseId(id);
      
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data) {
        setAmount(data.amount || '');
        setCategory(data.category || '');
        setDescription(data.description || '');
        setDate(data.date ? data.date.split('T')[0] : '');
      }
      setLoading(false);
    }
    loadExpense();
  }, [params, supabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const { error } = await supabase
      .from('expenses')
      .update({
        amount: parseFloat(amount),
        category,
        description,
        date
      })
      .eq('id', expenseId);
    
    if (error) {
      toast.error('Error updating expense');
    } else {
      toast.success('Expense updated successfully');
      router.push('/dashboard/expenses');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Toaster />
      <Link href="/dashboard/expenses" className="flex items-center gap-2 text-blue-600 mb-6">
        <ArrowLeft size={18} /> Back to Expenses
      </Link>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Edit Expense</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
            >
              <option value="">Select Category</option>
              <option value="office">Office Supplies</option>
              <option value="travel">Travel</option>
              <option value="software">Software</option>
              <option value="marketing">Marketing</option>
              <option value="rent">Rent</option>
              <option value="utilities">Utilities</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
              required
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
