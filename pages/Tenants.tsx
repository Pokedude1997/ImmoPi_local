
import React, { useState } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { db } from '../services/storage';
import { Tenant } from '../types';
import { Users, Plus, Trash2, Edit2, Calendar, Building, X, Search, UserCheck } from 'lucide-react';

export const Tenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>(db.getTenants());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [filter, setFilter] = useState('');
  
  // UI States for modal
  const [isCurrent, setIsCurrent] = useState(false);

  const properties = db.getProperties();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newTenant: Omit<Tenant, 'id'> & { id?: string } = {
      id: editingTenant?.id,
      name: formData.get('name') as string,
      propertyId: formData.get('propertyId') as string,
      startDate: formData.get('startDate') as string,
      endDate: isCurrent ? undefined : (formData.get('endDate') as string),
      isCurrent: isCurrent,
      notes: formData.get('notes') as string,
    };

    db.saveTenant(newTenant);
    setTenants(db.getTenants());
    setIsModalOpen(false);
    setEditingTenant(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Permanently remove this tenant record?")) {
      db.deleteTenant(id);
      setTenants(db.getTenants());
    }
  };

  const openEdit = (t: Tenant) => {
    setEditingTenant(t);
    setIsCurrent(t.isCurrent);
    setIsModalOpen(true);
  };

  const filtered = tenants.filter(t => 
    t.name.toLowerCase().includes(filter.toLowerCase()) || 
    t.id.includes(filter)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tenant Registry</h1>
          <p className="text-slate-500 text-sm font-medium">Manage occupancy and rental history</p>
        </div>
        <div className="flex gap-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search tenants..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button onClick={() => { setEditingTenant(null); setIsCurrent(false); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Tenant
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(t => (
          <Card key={t.id} className="overflow-hidden group hover:shadow-lg transition-all border-slate-200">
            <div className={`h-1 ${t.isCurrent ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${t.isCurrent ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">{t.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ID: {t.id}</p>
                  </div>
                </div>
                {t.isCurrent && (
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-emerald-100">
                    <UserCheck className="w-3 h-3" /> Current
                  </span>
                )}
              </div>

              <div className="space-y-4 py-4 border-y border-slate-50">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span className="font-medium truncate">
                    {properties.find(p => p.id === t.propertyId)?.name || 'Unassigned Property'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">
                    {new Date(t.startDate).toLocaleDateString()} — {t.isCurrent ? 'Ongoing' : t.endDate ? new Date(t.endDate).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => openEdit(t)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-slate-400 font-bold">No tenant records found</h3>
            <p className="text-slate-400 text-sm mt-1">Start by adding a new tenant to your registry.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {editingTenant ? 'Edit Tenant Record' : 'Tenant Admission'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
              <Input 
                name="name" 
                label="Full Name (Name & Surname)" 
                placeholder="Jane Doe" 
                defaultValue={editingTenant?.name} 
                required 
              />
              
              <Select name="propertyId" label="Assigned Property" defaultValue={editingTenant?.propertyId} required>
                <option value="">Select a property...</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <input 
                  type="checkbox" 
                  id="isCurrent" 
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                />
                <label htmlFor="isCurrent" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                  This is the current tenant
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  name="startDate" 
                  type="date" 
                  label="Rental Start Date" 
                  defaultValue={editingTenant?.startDate || new Date().toISOString().split('T')[0]} 
                  required 
                />
                <div className="space-y-1">
                  <label className={`block text-sm font-medium ${isCurrent ? 'text-slate-300' : 'text-slate-700'}`}>
                    Rental End Date
                  </label>
                  <input
                    name="endDate"
                    type="date"
                    disabled={isCurrent}
                    defaultValue={editingTenant?.endDate}
                    className={`block w-full rounded-md shadow-sm sm:text-sm border p-2.5 outline-none transition-colors ${
                      isCurrent 
                        ? 'bg-slate-50 border-slate-200 text-slate-300' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Discard</Button>
                <Button type="submit">
                  {editingTenant ? 'Update Registry' : 'Confirm Admission'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
