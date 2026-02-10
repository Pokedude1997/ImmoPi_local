
import React, { useState } from 'react';
import { Card, Button, Input } from '../components/ui';
import { db } from '../services/storage';
import { AppSettings } from '../types';
import { Save, CheckCircle2, ListChecks } from 'lucide-react';

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());
  const [msg, setMsg] = useState('');

  const handleSaveGeneral = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSettings: AppSettings = {
      ...settings,
      googleDriveFolderId: formData.get('googleDriveFolderId') as string,
      taxYear: Number(formData.get('taxYear')),
    };
    db.saveSettings(newSettings);
    setSettings(newSettings);
    setMsg('General settings updated.');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-slate-500 text-sm font-medium">Manage financial parameters and system integration</p>
        </div>
        {msg && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100 animate-in fade-in duration-300">
            <CheckCircle2 className="w-4 h-4" />
            {msg}
          </div>
        )}
      </div>
      
      {/* General Configuration */}
      <Card className="p-8 shadow-sm">
        <form onSubmit={handleSaveGeneral} className="space-y-8">
          <div>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
              <ListChecks className="w-4 h-4" /> Global Config
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Input 
                name="taxYear" 
                type="number" 
                label="Active Tax Year" 
                defaultValue={settings.taxYear} 
                className="font-bold"
              />
              <Input 
                name="currency" 
                label="Base Currency" 
                defaultValue={settings.currency} 
                disabled 
                className="bg-slate-50 font-bold"
              />
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100">
             <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
               Cloud Integration
             </h2>
             <p className="text-xs text-slate-500 mb-6 font-medium">
               Identifier for the local or cloud storage directory used for document processing.
             </p>
             <Input 
                name="googleDriveFolderId" 
                label="Folder ID / Path" 
                defaultValue={settings.googleDriveFolderId} 
                placeholder="root-folder-identifier"
             />
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" className="shadow-lg shadow-blue-100">
              <Save className="w-4 h-4 mr-2" />
              Update Core Settings
            </Button>
          </div>
        </form>
      </Card>
      
      <div className="text-center text-[10px] font-black text-slate-300 tracking-[0.3em] pt-10">
        IMMOPIDB &bull; v1.0.0 &bull; LOCAL_HOST
      </div>
    </div>
  );
};
