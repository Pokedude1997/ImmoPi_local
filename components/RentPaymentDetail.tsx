import React from 'react';
import { RentPayment, RentPaymentStatus, PaymentMethod } from '../types';
import { statusColors, statusLabels, paymentMethodLabels, formatDateFull } from '../constants';

interface RentPaymentDetailProps {
  payment: RentPayment;
  contractWarmRent?: number;
  onClose: () => void;
}

export const RentPaymentDetail: React.FC<RentPaymentDetailProps> = ({ 
  payment, 
  contractWarmRent = 0,
  onClose 
}) => {
  if (!payment) {
    return null;
  }
  
  const difference = payment.amount - contractWarmRent;
  const hasDifference = Math.abs(difference) > 0.01;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Rent Payment Details</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <span className="text-2xl text-slate-400 hover:text-slate-600">&times;</span>
          </button>
        </div>

        <div className="space-y-4">
          {/* Date */}
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Payment Date</p>
            <p className="text-lg font-bold text-slate-900">{formatDateFull(payment.date)}</p>
          </div>

          {/* Status */}
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</p>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[payment.status]}`}>
              {statusLabels[payment.status]}
            </span>
          </div>

          {/* Amounts */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Rent Breakdown</p>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Cold Rent</span>
              <span className="font-bold text-emerald-600">€{payment.coldRentAmount.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Side Costs</span>
              <span className="font-bold text-emerald-600">€{payment.sideCostsAmount.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-sm font-medium text-slate-900">Warm Rent (Paid)</span>
              <span className="font-bold text-emerald-600 text-lg">€{payment.amount.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Contract Warm Rent</span>
              <span className="font-medium text-slate-700">€{contractWarmRent.toFixed(2)}</span>
            </div>

            {hasDifference && (
              <div className={`flex justify-between items-center pt-2 border-t border-slate-200 ${
                difference > 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                <span className="text-sm font-medium">
                  {difference > 0 ? 'Extra Amount' : 'Shortfall'}
                </span>
                <span className="font-bold">
                  {difference > 0 ? '+' : ''}€{Math.abs(difference).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method */}
          {payment.paymentMethod && (
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Payment Method</p>
              <p className="font-medium text-slate-900">{paymentMethodLabels[payment.paymentMethod]}</p>
            </div>
          )}

          {/* Notes */}
          {payment.notes && (
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-slate-700">{payment.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Metadata</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500 mb-0.5">Payment ID</p>
                <p className="font-mono text-slate-900 truncate">{payment.id}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Contract ID</p>
                <p className="font-mono text-slate-900 truncate">{payment.tenantContractId}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Created</p>
                <p className="font-mono text-slate-900 truncate">{new Date(payment.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Updated</p>
                <p className="font-mono text-slate-900 truncate">{new Date(payment.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
