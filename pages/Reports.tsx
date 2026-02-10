
import React, { useState, useMemo } from 'react';
import { Card, Button, Select } from '../components/ui';
import { db } from '../services/storage';
import { CategoryType } from '../types';
import { FileBarChart2, Download, Table, Filter, AlertCircle, Calendar, Building } from 'lucide-react';

export const Reports = () => {
  const properties = db.getProperties();
  const categories = db.getCategories();
  const transactions = db.getTransactions();
  const settings = db.getSettings();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(properties[0]?.id || '');
  const [selectedYear, setSelectedYear] = useState<number>(settings.taxYear);

  // Available years based on transactions or just a standard range
  const years = useMemo(() => {
    const txYears = transactions.map(t => new Date(t.date).getFullYear());
    const uniqueYears = Array.from(new Set([settings.taxYear, ...txYears])).sort((a, b) => b - a);
    return uniqueYears;
  }, [transactions, settings.taxYear]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      const matchesYear = txDate.getFullYear() === selectedYear;
      const matchesProperty = selectedPropertyId === 'all' || t.propertyId === selectedPropertyId;
      return matchesYear && matchesProperty;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, selectedPropertyId, selectedYear]);

  const stats = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === CategoryType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = filteredTransactions
      .filter(t => t.type === CategoryType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, net: income - expenses };
  }, [filteredTransactions]);

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = ['Date', 'Category', 'Amount', 'Currency', 'Property', 'Description'];
    const rows = filteredTransactions.map(t => {
      const cat = categories.find(c => c.id === t.categoryId)?.name || 'Unknown';
      const prop = properties.find(p => p.id === t.propertyId)?.name || 'Unknown';
      return [
        t.date,
        cat,
        t.amount.toFixed(2),
        t.currency,
        `"${prop.replace(/"/g, '""')}"`,
        `"${t.description.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const propertyName = selectedPropertyId === 'all' ? 'All_Properties' : properties.find(p => p.id === selectedPropertyId)?.name || 'Property';
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ImmoPi_Report_${propertyName.replace(/\s+/g, '_')}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tax & Financial Reports</h1>
          <p className="text-slate-500 text-sm font-medium">Generate accounting exports for your properties</p>
        </div>
        <Button 
          onClick={handleExportCSV} 
          disabled={filteredTransactions.length === 0}
          className="shadow-lg shadow-blue-100"
        >
          <Download className="w-4 h-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Card */}
        <Card className="p-6 lg:col-span-1 h-fit space-y-6">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Filter className="w-3.5 h-3.5" /> Report Parameters
          </div>
          
          <div className="space-y-4">
            <Select 
              label="Select Property" 
              value={selectedPropertyId} 
              onChange={(e) => setSelectedPropertyId(e.target.value)}
            >
              <option value="all">All Portfolio</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>

            <Select 
              label="Tax Year" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
             <div className="flex justify-between items-center">
               <span className="text-xs font-bold text-slate-500">Income</span>
               <span className="text-xs font-black text-emerald-600">€{stats.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-xs font-bold text-slate-500">Expenses</span>
               <span className="text-xs font-black text-rose-600">€{stats.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>
             <div className="flex justify-between items-center pt-2 border-t border-slate-50">
               <span className="text-xs font-black text-slate-900 uppercase">Net Result</span>
               <span className={`text-sm font-black ${stats.net >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                 €{stats.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
               </span>
             </div>
          </div>
        </Card>

        {/* Preview Card */}
        <Card className="lg:col-span-3 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                <Table className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Report Preview</h2>
            </div>
            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100 uppercase">
              {filteredTransactions.length} Transactions Found
            </span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {filteredTransactions.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Property</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <Calendar className="w-3 h-3 text-slate-300" />
                          {new Date(t.date).toLocaleDateString('de-DE')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${
                          t.type === CategoryType.INCOME ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {categories.find(c => c.id === t.categoryId)?.name || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                          <Building className="w-3 h-3 text-slate-300" />
                          {properties.find(p => p.id === t.propertyId)?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate">
                        <span className="text-xs font-medium text-slate-600 italic">"{t.description}"</span>
                      </td>
                      <td className={`px-6 py-4 text-right whitespace-nowrap font-black text-xs ${
                        t.type === CategoryType.INCOME ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        {t.type === CategoryType.INCOME ? '+' : '-'} {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {t.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-slate-200" />
                </div>
                <h3 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No Data in Selection</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                  Adjust the property or year filter to preview transactions for your report.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="flex items-start gap-4 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
         <FileBarChart2 className="w-6 h-6 text-blue-400 mt-1" />
         <div>
           <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight">Accounting Compliance</h4>
           <p className="text-xs text-blue-700/80 leading-relaxed font-medium mt-1">
             This export provides a structured ledger for tax declarations (Anlage V). All amounts are derived from confirmed transactions 
             recorded in your ImmoPi local database. Ensure all mortgage principal and interest splits have been verified before filing.
           </p>
         </div>
      </div>
    </div>
  );
};
