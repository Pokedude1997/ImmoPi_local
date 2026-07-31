import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { api } from '../services/api';
import { Tenant, Property, TenantContract, RentPayment, RentPaymentStatus } from '../types';
import { Users, Plus, Trash2, Edit2, Calendar, Building, X, Search, UserCheck, FileText, Euro, Eye, Loader2 } from 'lucide-react';
import { TenantContractList } from '../components/TenantContractList';
import { TenantContractForm } from '../components/TenantContractForm';
import { RentPaymentList } from '../components/RentPaymentList';
import { RentPaymentForm } from '../components/RentPaymentForm';
import { RentPaymentDetail } from '../components/RentPaymentDetail';

export const Tenants = () => {
  // Data states
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [contracts, setContracts] = useState<TenantContract[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [filter, setFilter] = useState('');
  
  // Error states
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [isCurrent, setIsCurrent] = useState(false);
  
  // Contract modal states
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<TenantContract | null>(null);
  const [selectedTenantForContract, setSelectedTenantForContract] = useState<Tenant | null>(null);
  
  // Payment modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RentPayment | null>(null);
  const [selectedContractForPayment, setSelectedContractForPayment] = useState<TenantContract | null>(null);
  
  // Detail modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailPayment, setDetailPayment] = useState<RentPayment | null>(null);
  
  // Expandable sections
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [contractViewMode, setContractViewMode] = useState<'list' | 'payments'>('list');
  const [selectedContractForPayments, setSelectedContractForPayments] = useState<TenantContract | null>(null);

  // Initial data load
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tenantsData, propertiesData, contractsData, paymentsData] = await Promise.all([
        api.getTenants(),
        api.getProperties(),
        api.getTenantContracts(),
        api.getRentPayments(),
      ]);
      setTenants(tenantsData);
      setProperties(propertiesData);
      setContracts(contractsData);
      setPayments(paymentsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  // Tenant CRUD operations
  const handleTenantSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const tenantData: Omit<Tenant, 'id'> & { id?: string } = {
      id: editingTenant?.id,
      name: formData.get('name') as string,
      propertyId: formData.get('propertyId') as string,
      startDate: formData.get('startDate') as string,
      endDate: isCurrent ? undefined : (formData.get('endDate') as string || undefined),
      isCurrent: isCurrent,
      notes: formData.get('notes') as string,
    };

    try {
      if (editingTenant?.id) {
        await api.updateTenant(editingTenant.id, tenantData);
      } else {
        await api.createTenant(tenantData as Omit<Tenant, 'id'>);
      }
      await loadData();
      setIsTenantModalOpen(false);
      setEditingTenant(null);
      setIsCurrent(false);
    } catch (error) {
      console.error('Failed to save tenant:', error);
      setError(error instanceof Error ? error.message : 'Failed to save tenant. Please try again.');
    }
  };

  const handleDeleteTenant = async (id: string) => {
    if (confirm("Permanently remove this tenant record? This will not remove associated contracts and payments.")) {
      try {
        await api.deleteTenant(id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete tenant:', error);
      }
    }
  };

  const openEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setIsCurrent(tenant.isCurrent);
    setIsTenantModalOpen(true);
  };

  // Contract CRUD operations
  const handleContractSubmit = async (contract: TenantContract) => {
    await loadData();
    setIsContractModalOpen(false);
    setEditingContract(null);
    setSelectedTenantForContract(null);
    if (expandedTenantId) {
      setContractViewMode('list');
    }
  };

  const handleDeleteContract = async (contract: TenantContract) => {
    if (window.confirm(`Delete contract ${contract.id}? This will not delete associated payments.`)) {
      try {
        await api.deleteTenantContract(contract.id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete contract:', error);
      }
    }
  };

  const openContractModal = (tenant: Tenant, contract?: TenantContract) => {
    setSelectedTenantForContract(tenant);
    setEditingContract(contract || null);
    setIsContractModalOpen(true);
  };

  // Payment CRUD operations
  const handlePaymentSubmit = async (payment: RentPayment) => {
    await loadData();
    setIsPaymentModalOpen(false);
    setEditingPayment(null);
    setSelectedContractForPayment(null);
  };

  const handleDeletePayment = async (payment: RentPayment) => {
    if (window.confirm(`Delete rent payment for ${payment.date}?`)) {
      try {
        await api.deleteRentPayment(payment.id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete payment:', error);
      }
    }
  };

  const openPaymentModal = (contract: TenantContract, payment?: RentPayment) => {
    setSelectedContractForPayment(contract);
    setEditingPayment(payment || null);
    setIsPaymentModalOpen(true);
  };

  // View payment details
  const openPaymentDetail = (payment: RentPayment, contract: TenantContract) => {
    const warmRent = contract.coldRent + contract.sideCosts;
    setDetailPayment(payment);
    setIsDetailModalOpen(true);
  };

  const closePaymentDetail = () => {
    setIsDetailModalOpen(false);
    setDetailPayment(null);
  };

  // Filter tenants
  const filtered = tenants.filter(t => 
    t.name.toLowerCase().includes(filter.toLowerCase()) || 
    t.id.includes(filter)
  );

  // Get contracts for a tenant
  const getTenantContracts = (tenantId: string) => {
    return contracts.filter(c => c.tenantId === tenantId);
  };

  // Get payments for a contract
  const getContractPayments = (contractId: string) => {
    return payments.filter(p => p.tenantContractId === contractId);
  };

  // Toggle tenant expansion
  const toggleTenantExpansion = (tenantId: string) => {
    if (expandedTenantId === tenantId) {
      setExpandedTenantId(null);
      setContractViewMode('list');
      setSelectedContractForPayments(null);
    } else {
      setExpandedTenantId(tenantId);
      setContractViewMode('list');
      setSelectedContractForPayments(null);
    }
  };

  // Back to contracts list from payments view
  const backToContracts = () => {
    setContractViewMode('list');
    setSelectedContractForPayments(null);
  };

  // View payments for a contract
  const viewContractPayments = (contract: TenantContract) => {
    setSelectedContractForPayments(contract);
    setContractViewMode('payments');
  };

  // Get property name
  const getPropertyName = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? property.name : `Property ${propertyId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-600">Loading tenants...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tenant Registry</h1>
          <p className="text-slate-500 text-sm font-medium">Manage occupancy, contracts, and rent payments</p>
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
          <Button onClick={() => { setEditingTenant(null); setIsCurrent(false); setIsTenantModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Tenant
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-3">
          <span className="text-red-500">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800 font-medium">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {filtered.length > 0 ? (
          filtered.map(t => {
            const tenantContracts = getTenantContracts(t.id);
            const isExpanded = expandedTenantId === t.id;
            
            return (
              <div key={t.id} className="space-y-2">
                <Card 
                  key={t.id} 
                  className={`overflow-hidden group hover:shadow-lg transition-all border-slate-200 ${
                    isExpanded ? 'ring-2 ring-emerald-500 border-emerald-500' : ''
                  }`}
                >
                  <div className={`h-1 ${t.isCurrent ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => toggleTenantExpansion(t.id)}
                          className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                          <div className={`w-5 h-5 flex items-center justify-center ${
                            isExpanded ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                          } rounded-lg`}>
                            <span className="text-sm font-bold">{isExpanded ? '−' : '+'}</span>
                          </div>
                        </button>
                        <div className={`p-3 rounded-xl ${
                          t.isCurrent ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                        }`}>
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
                          {getPropertyName(t.propertyId)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">
                          {new Date(t.startDate).toLocaleDateString()} — {t.isCurrent ? 'Ongoing' : t.endDate ? new Date(t.endDate).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">
                          {tenantContracts.length} contract{tenantContracts.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <button 
                        onClick={() => openEditTenant(t)} 
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTenant(t.id)} 
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openContractModal(t)} 
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Add Contract"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>

                {isExpanded && (
                  <div className="ml-4 md:ml-12 space-y-4">
                    <div className="flex gap-2 pt-2">
                      {contractViewMode === 'list' ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openContractModal(t)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Contract
                        </Button>
                      ) : (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={backToContracts}
                          >
                            ← Back to Contracts
                          </Button>
                          {selectedContractForPayments && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openPaymentModal(selectedContractForPayments)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Payment
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    {contractViewMode === 'list' ? (
                      <TenantContractList
                        contracts={tenantContracts}
                        properties={properties}
                        onEdit={(contract) => openContractModal(t, contract)}
                        onDelete={(contract) => handleDeleteContract(contract)}
                        onViewPayments={(contract) => viewContractPayments(contract)}
                      />
                    ) : (
                      selectedContractForPayments && (
                        <RentPaymentList
                          payments={getContractPayments(selectedContractForPayments.id)}
                          onEdit={(payment) => openPaymentModal(selectedContractForPayments, payment)}
                          onDelete={(payment) => handleDeletePayment(payment)}
                          onRefresh={loadData}
                        />
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-slate-400 font-bold">No tenant records found</h3>
            <p className="text-slate-400 text-sm mt-1">Start by adding a new tenant to your registry.</p>
          </div>
        )}
      </div>

      {isTenantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {editingTenant ? 'Edit Tenant Record' : 'Tenant Admission'}
              </h2>
              <button onClick={() => setIsTenantModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleTenantSubmit} className="p-8 space-y-6 bg-white">
              <Input 
                name="name" 
                label="Full Name (Name & Surname)" 
                placeholder="Jane Doe" 
                defaultValue={editingTenant?.name} 
                required 
              />
              
              <Select name="propertyId" label="Assigned Property" defaultValue={editingTenant?.propertyId} required>
                <option value="">Select a property...</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.address})</option>)}
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

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  name="notes"
                  defaultValue={editingTenant?.notes}
                  rows={3}
                  className="w-full p-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsTenantModalOpen(false)}>Discard</Button>
                <Button type="submit">
                  {editingTenant ? 'Update Registry' : 'Confirm Admission'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {isContractModalOpen && selectedTenantForContract && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {editingContract ? 'Edit Contract' : 'Create New Contract'}
              </h2>
              <button onClick={() => setIsContractModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <TenantContractForm
              tenant={selectedTenantForContract}
              contract={editingContract || undefined}
              properties={properties}
              onSubmit={handleContractSubmit}
              onCancel={() => setIsContractModalOpen(false)}
            />
          </Card>
        </div>
      )}

      {isPaymentModalOpen && selectedContractForPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {editingPayment ? 'Edit Rent Payment' : 'Record Rent Payment'}
              </h2>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <RentPaymentForm
              contract={selectedContractForPayment}
              payment={editingPayment || undefined}
              onSubmit={handlePaymentSubmit}
              onCancel={() => setIsPaymentModalOpen(false)}
            />
          </Card>
        </div>
      )}

      {isDetailModalOpen && detailPayment && (
        <RentPaymentDetail
          payment={detailPayment}
          contractWarmRent={selectedContractForPayments ? selectedContractForPayments.coldRent + selectedContractForPayments.sideCosts : 0}
          onClose={closePaymentDetail}
        />
      )}
    </div>
  );
};
