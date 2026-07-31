import React, { useState, useEffect } from 'react';
import { TenantContract, Tenant, Property } from '../types';
import { api } from '../services/api';

interface TenantContractFormProps {
  tenant: Tenant;
  contract?: TenantContract;
  properties: Property[];
  onSubmit: (contract: TenantContract) => void;
  onCancel: () => void;
}

export const TenantContractForm: React.FC<TenantContractFormProps> = ({ 
  tenant, 
  contract, 
  properties, 
  onSubmit, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    propertyId: contract?.propertyId || '',
    startDate: contract?.startDate || new Date().toISOString().split('T')[0],
    endDate: contract?.endDate || '',
    coldRent: contract?.coldRent || 0,
    sideCosts: contract?.sideCosts || 0,
    paymentDayOfMonth: contract?.paymentDayOfMonth || 31,
    isActive: contract?.isActive !== undefined ? contract.isActive : true,
    notes: contract?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate warm rent
  const warmRent = formData.coldRent + formData.sideCosts;

  // Generate day of month options (1-31)
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: parseFloat(value) || 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.propertyId) {
        setError('Property is required');
        setLoading(false);
        return;
      }

      if (!formData.startDate) {
        setError('Start date is required');
        setLoading(false);
        return;
      }

      if (formData.coldRent < 0) {
        setError('Cold rent must be positive');
        setLoading(false);
        return;
      }

      if (formData.sideCosts < 0) {
        setError('Side costs must be positive');
        setLoading(false);
        return;
      }

      if (formData.paymentDayOfMonth < 1 || formData.paymentDayOfMonth > 31) {
        setError('Payment day must be between 1 and 31');
        setLoading(false);
        return;
      }

      const contractData = {
        tenantId: tenant.id,
        propertyId: formData.propertyId,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        coldRent: formData.coldRent,
        sideCosts: formData.sideCosts,
        paymentDayOfMonth: formData.paymentDayOfMonth,
        isActive: formData.isActive,
        notes: formData.notes,
      };

      let result: TenantContract;
      
      if (contract?.id) {
        // Update existing contract
        result = await api.updateTenantContract(contract.id, contractData);
      } else {
        // Create new contract
        result = await api.createTenantContract(contractData);
      }

      onSubmit(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contract');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border-b border-slate-200 pb-4 mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          {contract?.id ? 'Edit Contract' : 'Create New Contract'}
        </h3>
        <p className="text-sm text-slate-500">
          Tenant: {tenant.name} - Warm Rent: €{warmRent.toFixed(2)}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Property</label>
          <select
            name="propertyId"
            value={formData.propertyId}
            onChange={handleChange}
            required
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">Select Property</option>
            {properties.map(property => (
              <option key={property.id} value={property.id}>
                {property.name} ({property.address})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            required
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">End Date (Optional)</label>
          <input
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleChange}
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Day of Month</label>
          <select
            name="paymentDayOfMonth"
            value={formData.paymentDayOfMonth}
            onChange={handleChange}
            required
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {dayOptions.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cold Rent (€)</label>
          <input
            type="number"
            name="coldRent"
            value={formData.coldRent}
            onChange={handleChange}
            step="0.01"
            min="0"
            required
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Side Costs (€)</label>
          <input
            type="number"
            name="sideCosts"
            value={formData.sideCosts}
            onChange={handleChange}
            step="0.01"
            min="0"
            defaultValue={0}
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Warm Rent (€) - Auto-Calculated
        </label>
        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="font-semibold text-emerald-600">€{warmRent.toFixed(2)}</span>
          <span className="text-sm text-slate-500 ml-2">
            (Cold: €{formData.coldRent.toFixed(2)} + Side: €{formData.sideCosts.toFixed(2)})
          </span>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="isActive"
            checked={formData.isActive}
            onChange={handleChange}
            className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-slate-700">Active Contract</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Saving...' : contract?.id ? 'Update Contract' : 'Create Contract'}
        </button>
      </div>
    </form>
  );
};
