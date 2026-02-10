import React, { useState } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { db } from '../services/storage';
import { Transaction, CategoryType } from '../types';
import { Plus, Download, Search, Trash2, X, Calendar, Activity } from 'lucide-react';

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
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Ledger & History</h1>
          <p className="text-slate-500 text-sm font-medium">Complete record of financial movements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} className="bg-white">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 mr-2" /> Add Transaction
          </Button>
        </div>
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        <input 
          type="text" 
          placeholder="Filter by description or amount..." 
          className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full shadow-sm text-slate-900"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Property</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-300" />
                      {new Date(t.date).toLocaleDateString('de-DE')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                       {/* Fix: Lucide icons do not support 'title' prop, moved to wrapper span */}
                       {t.isAutoGenerated && <span title="Automated"><Activity className="w-3 h-3 text-blue-400" /></span>}
                       {t.description}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight bg-slate-100 text-slate-600">
                      {categories.find(c => c.id === t.categoryId)?.name || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-500 italic">
                    {properties.find(p => p.id === t.propertyId)?.name || '—'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-xs text-right font-black ${t.type === CategoryType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {t.type === CategoryType.INCOME ? '+' : '-'} {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {t.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => handleDelete(t.id)} 
                      className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center gap-2">
               <div className="p-3 bg-slate-50 rounded-full text-slate-300">
                 <Search className="w-8 h-8" />
               </div>
               <p className="text-slate-400 font-bold text-sm">No transactions match your search.</p>
            </div>
          )}
        </div>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-xl p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Post Transaction</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Input name="date" type="date" label="Value Date" defaultValue={new Date().toISOString().split('T')[0]} required />
                 <Input name="amount" type="number" step="0.01" label="Amount" placeholder="0.00" required />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Input name="currency" label="Currency" defaultValue="EUR" required />
                 <Select name="categoryId" label="Accounting Category" required>
                    <option value="">Select Category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                 </Select>
              </div>
              
              <Select name="propertyId" label="Linked Property" required>
                  <option value="">Select Property...</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Internal Description</label>
                <textarea 
                  name="description" 
                  className="block w-full rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-4 min-h-[100px]"
                  placeholder="Details of the payment..."
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Discard</Button>
                <Button type="submit">Commit Transaction</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};