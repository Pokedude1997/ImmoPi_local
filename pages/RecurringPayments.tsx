import React, { useState } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { db } from '../services/storage';
import { RecurringPayment, CategoryType } from '../types';
import { Plus, Trash2, Calendar, RefreshCw, Clock } from 'lucide-react';

export const RecurringPayments = () => {
  const [payments, setPayments] = useState<RecurringPayment[]>(db.getRecurringPayments());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const properties = db.getProperties();
  const categories = db.getCategories();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const catId = formData.get('categoryId') as string;
    const cat = categories.find(c => c.id === catId);

    const newPayment: Omit<RecurringPayment, 'id'> = {
      name: formData.get('name') as string,
      type: cat?.type || CategoryType.EXPENSE,
      propertyId: formData.get('propertyId') as string,
      categoryId: catId,
      amount: Number(formData.get('amount')),
      frequency: formData.get('frequency') as any,
      startDate: formData.get('startDate') as string,
      nextDueDate: formData.get('startDate') as string, // Initialize next due as start date
      active: true,
    };

    db.saveRecurringPayment(newPayment);
    setPayments(db.getRecurringPayments());
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this recurring payment plan?")) {
      db.deleteRecurringPayment(id);
      setPayments(db.getRecurringPayments());
    }
  };

  const toggleStatus = (p: RecurringPayment) => {
    db.saveRecurringPayment({ ...p, active: !p.active });
    setPayments(db.getRecurringPayments());
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recurring Payments</h1>
          <p className="text-slate-500 text-sm">Automate your regular rent and expenses.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {payments.map(p => (
          <Card key={p.id} className={`p-5 transition-all border-l-4 ${p.active ? 'border-l-blue-600' : 'border-l-slate-300 opacity-75'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${p.type === CategoryType.INCOME ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{p.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                    <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" /> {p.frequency}</span>
                    <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> Next: {new Date(p.nextDueDate).toLocaleDateString()}</span>
                    <span>Property: {properties.find(prop => prop.id === p.propertyId)?.name}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                <div className="text-right">
                  <p className={`font-black text-lg ${p.type === CategoryType.INCOME ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {p.type === CategoryType.INCOME ? '+' : '-'}€{p.amount.toLocaleString()}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Amount per cycle</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="text-xs" onClick={() => toggleStatus(p)}>
                    {p.active ? 'Pause' : 'Activate'}
                  </Button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {payments.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-slate-500 font-medium">No recurring payments scheduled</h3>
            <p className="text-slate-400 text-sm mt-1">Save time by automating monthly rent or regular utility bills.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">New Payment Schedule</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input name="name" label="Plan Name (e.g. Monthly Rent)" placeholder="Tenant Name - Rent" required />
              
              <div className="grid grid-cols-2 gap-4">
                <Input name="amount" type="number" step="0.01" label="Amount" required />
                <Select name="frequency" label="Frequency">
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <Select name="categoryId" label="Category" required>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                 </Select>
                 <Select name="propertyId" label="Property" required>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </Select>
              </div>

              <Input name="startDate" type="date" label="Starting From (First payment date)" defaultValue={new Date().toISOString().split('T')[0]} required />
              
              <div className="flex justify-end gap-3 pt-6 mt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit">Create Schedule</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};