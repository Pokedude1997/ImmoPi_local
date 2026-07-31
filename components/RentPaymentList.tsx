import React, { useState } from 'react';
import { RentPayment, RentPaymentStatus, PaymentMethod } from '../types';
import { api } from '../services/api';
import { statusColors, statusLabels, paymentMethodLabels } from '../constants';

interface RentPaymentListProps {
  payments: RentPayment[];
  onEdit: (payment: RentPayment) => void;
  onDelete: (payment: RentPayment) => void;
  onRefresh: () => void;
}

export const RentPaymentList: React.FC<RentPaymentListProps> = ({ 
  payments, 
  onEdit, 
  onDelete,
  onRefresh 
}) => {
  const [filterStatus, setFilterStatus] = useState<RentPaymentStatus | ''>('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter payments
  const filteredPayments = filterStatus 
    ? payments.filter(p => p.status === filterStatus)
    : payments;

  // Sort payments
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleDelete = (payment: RentPayment) => {
    onDelete(payment);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Rent Payments</h3>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as RentPaymentStatus | '')}
            className="p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value={RentPaymentStatus.PAID}>Paid</option>
            <option value={RentPaymentStatus.PENDING}>Pending</option>
            <option value={RentPaymentStatus.OVERDUE}>Overdue</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'status')}
            className="p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="status">Status</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Order</label>
          <select
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
            className="p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Method</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {sortedPayments.length > 0 ? (
              sortedPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-900">
                    {new Date(payment.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-900">
                    €{payment.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[payment.status]}`}>
                      {statusLabels[payment.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500">
                    {paymentMethodLabels[payment.paymentMethod || '']}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(payment)}
                        className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(payment)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  No rent payments found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="pt-2">
        <p className="text-sm text-slate-500">
          Showing {sortedPayments.length} of {payments.length} payments
        </p>
      </div>
    </div>
  );
};
