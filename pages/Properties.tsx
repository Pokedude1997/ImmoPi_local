
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { db } from '../services/storage';
import { Property, PropertyType, MortgageConfig } from '../types';
import { Building, MapPin, Plus, Trash2, Edit2, Landmark, Info, CheckCircle2, X, TrendingDown } from 'lucide-react';

export const Properties = () => {
  const [properties, setProperties] = useState<Property[]>(db.getProperties());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [showMortgageFields, setShowMortgageFields] = useState(false);

  useEffect(() => {
    if (editingProp) {
      setShowMortgageFields(!!editingProp.mortgage);
    } else {
      setShowMortgageFields(false);
    }
  }, [editingProp, isModalOpen]);

  const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const calculateRemainingBalance = (mortgage: MortgageConfig) => {
    const start = parseLocalDate(mortgage.startDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const monthlyInterestFactor = mortgage.interestRate / 100 / 12;
    const annualTotalRate = (mortgage.interestRate + mortgage.principalRate) / 100;
    const monthlyPayment = (mortgage.loanAmount * annualTotalRate) / 12;

    let balance = mortgage.loanAmount;
    let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);
    const stopDateMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    while (currentDate <= stopDateMonth) {
      let paymentDate: Date;
      if (mortgage.paymentTiming === 'END_OF_MONTH') {
        paymentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      } else {
        paymentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      }

      if (paymentDate <= now) {
        const interestPart = balance * monthlyInterestFactor;
        const principalPart = monthlyPayment - interestPart;
        balance -= principalPart;
      } else {
        // Critical fix: If the payment date for this cycle is in the future, we stop.
        break;
      }
      
      currentDate.setMonth(currentDate.getMonth() + 1);
      if (balance <= 0) return 0;
    }
    return balance;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const hasMortgage = formData.get('hasMortgage') === 'on';

    const updatedProp: Omit<Property, 'id'> & { id?: string } = {
      id: editingProp?.id,
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      type: formData.get('type') as PropertyType,
      notes: formData.get('notes') as string,
    };

    if (hasMortgage) {
      updatedProp.mortgage = {
        loanAmount: Number(formData.get('loanAmount')),
        startDate: formData.get('mortgageStartDate') as string,
        interestRate: Number(formData.get('interestRate')),
        principalRate: Number(formData.get('principalRate')),
        bankName: formData.get('bankName') as string,
        paymentTiming: formData.get('paymentTiming') as 'START_OF_MONTH' | 'END_OF_MONTH',
      };
    } else {
      updatedProp.mortgage = undefined;
    }

    db.saveProperty(updatedProp);
    setProperties(db.getProperties());
    setIsModalOpen(false);
    setEditingProp(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this property? Historical transactions will be preserved but financing automation will stop.")) {
      db.deleteProperty(id);
      setProperties(db.getProperties());
    }
  };

  const openEdit = (p: Property) => {
    setEditingProp(p);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Property Portfolio</h1>
          <p className="text-sm text-slate-500 font-medium">Manage your real estate assets and leverage</p>
        </div>
        <Button onClick={() => { setEditingProp(null); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Property
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {properties.map(p => {
          const remainingBalance = p.mortgage ? calculateRemainingBalance(p.mortgage) : 0;
          return (
            <Card key={p.id} className="overflow-hidden flex flex-col group hover:shadow-lg transition-all duration-300">
              <div className={`h-1.5 ${p.mortgage ? 'bg-indigo-600' : 'bg-blue-600'}`} />
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">{p.name}</h3>
                    <div className="flex items-center text-slate-500 text-sm mt-1">
                      <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      {p.address}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                    <Building className="w-5 h-5" />
                  </div>
                </div>

                {p.mortgage && (
                  <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                        <Landmark className="w-3.5 h-3.5" /> Finance Active
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-indigo-400 text-[10px] font-bold uppercase">Initial Loan</p>
                          <p className="font-bold text-indigo-900">€{p.mortgage.loanAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-indigo-400 text-[10px] font-bold uppercase">Rate (Total)</p>
                          <p className="font-bold text-indigo-900">{(p.mortgage.interestRate + p.mortgage.principalRate).toFixed(2)}%</p>
                        </div>
                      </div>
                      
                      <div className="pt-2 mt-2 border-t border-indigo-100/30">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-indigo-400 text-[10px] font-bold uppercase flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" /> Remaining Debt
                            </p>
                            <p className="font-black text-indigo-700 text-base leading-tight">
                              €{remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="text-right">
                             <p className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Paid On</p>
                             <p className="text-[10px] font-bold text-indigo-900">{p.mortgage.paymentTiming === 'START_OF_MONTH' ? '1st' : 'End'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">
                    {p.type}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Edit2 className="w-4.5 h-4.5" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {properties.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-slate-500 font-bold text-lg">Your portfolio is empty</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto leading-relaxed">
              Register assets to automate income, expenses, and interest splitting.
            </p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 bg-white border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {editingProp ? 'Edit Property' : 'Asset Registration'}
                </h2>
                <p className="text-slate-500 text-xs font-medium">Configure basic and financial data</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="bg-white">
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Building className="w-4 h-4" /> Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input name="name" label="Property Name" placeholder="e.g. Skyline Apartment 4B" defaultValue={editingProp?.name} required />
                    <Select name="type" label="Asset Class" defaultValue={editingProp?.type || PropertyType.APARTMENT}>
                      {Object.values(PropertyType).map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                  <Input name="address" label="Site Address" placeholder="Street, ZIP, City" defaultValue={editingProp?.address} required />
                </div>

                <div className="pt-8 border-t border-slate-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Landmark className="w-4 h-4" /> Financing & Tax Split
                    </h3>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                      <input 
                        type="checkbox" 
                        id="hasMortgage" 
                        name="hasMortgage" 
                        checked={showMortgageFields}
                        onChange={(e) => setShowMortgageFields(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="hasMortgage" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        {showMortgageFields ? 'Integration Active' : 'Enable Integration'}
                      </label>
                    </div>
                  </div>

                  {showMortgageFields ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 animate-in slide-in-from-top-4 duration-300">
                       <Input name="loanAmount" type="number" label="Initial Loan Amount (€)" placeholder="250000" defaultValue={editingProp?.mortgage?.loanAmount} required={showMortgageFields} />
                       <Input name="bankName" label="Lending Institution" placeholder="e.g. Sparkasse, ING" defaultValue={editingProp?.mortgage?.bankName} />
                       <Select name="paymentTiming" label="Monthly Payment Schedule" defaultValue={editingProp?.mortgage?.paymentTiming || 'START_OF_MONTH'}>
                          <option value="START_OF_MONTH">Beginning of Month (1st)</option>
                          <option value="END_OF_MONTH">End of Month (Last Day)</option>
                       </Select>
                       <Input name="mortgageStartDate" type="date" label="Amortization Start Month" defaultValue={editingProp?.mortgage?.startDate || new Date().toISOString().split('T')[0]} required={showMortgageFields} />
                       <Input name="interestRate" type="number" step="0.001" label="Annual Interest (%)" placeholder="3.5" defaultValue={editingProp?.mortgage?.interestRate} required={showMortgageFields} />
                       <Input name="principalRate" type="number" step="0.001" label="Annual Principal (%)" placeholder="2.0" defaultValue={editingProp?.mortgage?.principalRate} required={showMortgageFields} />
                       <div className="md:col-span-2 flex items-start gap-3 p-4 bg-indigo-50 text-indigo-700 rounded-xl text-[11px] leading-relaxed font-bold border border-indigo-100/50">
                          <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-indigo-400" />
                          <p>Calculations are date-sensitive. Debt updates only after the selected payout day has passed for the current month.</p>
                       </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
                      <Landmark className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm font-medium">Automatic mortgage splitting is currently disabled for this asset.</p>
                    </div>
                  )}
                </div>

                <div className="pt-8 border-t border-slate-100 space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Edit2 className="w-4 h-4" /> Internal Remarks
                  </h3>
                  <textarea 
                    name="notes" 
                    defaultValue={editingProp?.notes}
                    className="block w-full rounded-xl border-slate-300 bg-white text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-4 min-h-[100px]"
                    placeholder="Additional details..."
                  />
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Discard</Button>
                <Button type="submit" className="px-8 shadow-sm">
                   {editingProp ? 'Sync & Save Changes' : 'Register Property'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
