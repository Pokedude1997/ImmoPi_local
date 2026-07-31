import React, { useState, useEffect } from 'react';
import { RentPayment, RentPaymentStatus, PaymentMethod, TenantContract } from '../types';
import { api } from '../services/api';

interface RentPaymentFormProps {
  contract: TenantContract;
  payment?: RentPayment;
  onSubmit: (payment: RentPayment) => void;
  onCancel: () => void;
}

const paymentStatusOptions = [
  { value: RentPaymentStatus.PAID, label: 'Paid' },
  { value: RentPaymentStatus.PENDING, label: 'Pending' },
  { value: RentPaymentStatus.OVERDUE, label: 'Overdue' },
];

const paymentMethodOptions = [
  { value: PaymentMethod.BANK_TRANSFER, label: 'Bank Transfer' },
  { value: PaymentMethod.CASH, label: 'Cash' },
  { value: PaymentMethod.OTHER, label: 'Other' },
];

export const RentPaymentForm: React.FC<RentPaymentFormProps> = ({ contract, payment, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    date: payment?.date || new Date().toISOString().split('T')[0],
    amount: payment?.amount || contract.coldRent + contract.sideCosts,
    coldRentAmount: payment?.coldRentAmount || contract.coldRent,
    sideCostsAmount: payment?.sideCostsAmount || contract.sideCosts,
    status: payment?.status || RentPaymentStatus.PAID,
    paymentMethod: payment?.paymentMethod || PaymentMethod.BANK_TRANSFER,
    notes: payment?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate warm rent
  const warmRent = formData.coldRentAmount + formData.sideCostsAmount;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.date) {
        setError('Date is required');
        setLoading(false);
        return;
      }

      if (formData.amount <= 0) {
        setError('Amount must be greater than 0');
        setLoading(false);
        return;
      }

      const paymentData = {
        tenantContractId: contract.id,
        date: formData.date,
        amount: warmRent,
        coldRentAmount: formData.coldRentAmount,
        sideCostsAmount: formData.sideCostsAmount,
        status: formData.status,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
      };

      let result: RentPayment;
      
      if (payment?.id) {
        // Update existing payment
        result = await api.updateRentPayment(payment.id, paymentData);
      } else {
        // Create new payment
        result = await api.createRentPayment(paymentData);
      }

      onSubmit(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rent payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border-b border-slate-200 pb-4 mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          {payment?.id ? 'Edit Rent Payment' : 'Record Rent Payment'}
        </h3>
        <p className="text-sm text-slate-500">
          Contract: {contract.id} - Warm Rent: €{warmRent.toFixed(2)}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {paymentStatusOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cold Rent (€)</label>
          <input
            type="number"
            name="coldRentAmount"
            value={formData.coldRentAmount}
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
            name="sideCostsAmount"
            value={formData.sideCostsAmount}
            onChange={handleChange}
            step="0.01"
            min="0"
            required
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Warm Rent (€) - Read Only
        </label>
        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="font-semibold">€{warmRent.toFixed(2)}</span>
          <span className="text-sm text-slate-500 ml-2">
            (Cold: €{formData.coldRentAmount.toFixed(2)} + Side: €{formData.sideCostsAmount.toFixed(2)})
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
        <select
          name="paymentMethod"
          value={formData.paymentMethod || ''}
          onChange={handleChange}
          className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          {paymentMethodOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
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
          {loading ? 'Saving...' : payment?.id ? 'Update Payment' : 'Record Payment'}
        </button>
      </div>
    </form>
  );
};
