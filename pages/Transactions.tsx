import React, { useState } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { db } from '../services/storage';
import { Transaction, CategoryType } from '../types';
import { Plus, Download, Search, Trash2, X } from 'lucide-react';

export const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(db.getTransactions());
  const [filter, setFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const properties = db.getProperties();
  const categories = db.getCategories();

  const filtered = transactions.filter(t => 
    t.description.toLowerCase().includes(filter.toLowerCase()) || 
    t.amount.toString().includes(filter)
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDelete = (id: string) => {
    if (confirm("Delete this transaction?")) {
      db.deleteTransaction(id);
      setTransactions(db.getTransactions());
    }
  };

  const handleExport = () => {
    // Generate CSV
    const headers = ['Date', 'Type', 'Amount', 'Currency', 'Description', 'Category', 'Property'];
    const rows = transactions.map(t => [
      t.date,
      t.type,
      t.amount,
      t.currency,
      `"${t.description.replace(/"/g, '""')}"`,
      categories.find(c => c.id === t.categoryId)?.name || 'Unknown',
      properties.find(p => p.id === t.propertyId)?.name || 'Unknown'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "transactions_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const catId = formData.get('categoryId') as string;
    const cat = categories.find(c => c.id === catId);

    db.saveTransaction({
      date: formData.get('date') as string,
      amount: Number(formData.get('amount')),
      currency: formData.get('currency') as string,
      description: formData.get('description') as string,
      categoryId: catId,
      type: cat?.type || CategoryType.EXPENSE,
      propertyId: formData.get('propertyId') as string,
    });
    setTransactions(db.getTransactions());
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Transaction
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 max-w-md">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input 
          type="text" 
          placeholder="Search transactions..." 
          className="flex-1 outline-none text-sm p-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Property</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(t.date).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{t.description}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                      {categories.find(c => c.id === t.categoryId)?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {properties.find(p => p.id === t.propertyId)?.name}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${t.type === CategoryType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {t.type === CategoryType.INCOME ? '+' : '-'} {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {t.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Add Transaction</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Input name="date" type="date" label="Date" defaultValue={new Date().toISOString().split('T')[0]} required />
                 <Input name="amount" type="number" step="0.01" label="Amount" placeholder="0.00" required />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Input name="currency" label="Currency" defaultValue="EUR" required />
                 <Select name="categoryId" label="Category" required>
                    <option value="">Select Category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                 </Select>
              </div>
              
              <Select name="propertyId" label="Property" required>
                  <option value="">Select Property...</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea 
                  name="description" 
                  className="block w-full rounded-md border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2.5 min-h-[100px]"
                  placeholder="Rent payment from tenant..."
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit">Save Transaction</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};