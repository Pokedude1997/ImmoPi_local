import React from 'react';
import { TenantContract } from '../types';
import { Property } from '../types';
import { formatDateShort } from '../constants';

interface TenantContractListProps {
  contracts: TenantContract[];
  properties: Property[];
  onEdit: (contract: TenantContract) => void;
  onDelete: (contract: TenantContract) => void;
  onViewPayments: (contract: TenantContract) => void;
}

// Contract status colors (different from payment status)
const contractStatusColors = {
  true: 'bg-emerald-100 text-emerald-800',
  false: 'bg-slate-100 text-slate-800',
};

const contractStatusLabels = {
  true: 'Active',
  false: 'Inactive',
};

export const TenantContractList: React.FC<TenantContractListProps> = ({ 
  contracts, 
  properties, 
  onEdit, 
  onDelete,
  onViewPayments 
}) => {
  const getPropertyName = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? property.name : `Property ${propertyId}`;
  };

  const handleDelete = (contract: TenantContract) => {
    onDelete(contract);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Contracts</h3>
      </div>

      {contracts.length > 0 ? (
        <div className="grid gap-4">
          {contracts.map((contract) => {
            const warmRent = contract.coldRent + contract.sideCosts;
            const propertyName = getPropertyName(contract.propertyId);
            
            return (
              <div 
                key={contract.id} 
                className="p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-slate-900">
                        {propertyName}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${contractStatusColors[contract.isActive]}`}>
                        {contractStatusLabels[contract.isActive]}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-500 mb-2">
                      {formatDateShort(contract.startDate)} - 
                      {contract.endDate ? formatDateShort(contract.endDate) : 'Ongoing'}
                    </p>

                    <div className="text-sm text-slate-700">
                      <div className="flex gap-4">
                        <span>
                          <span className="text-slate-500">Cold Rent:</span> 
                          <span className="font-medium">€{contract.coldRent.toFixed(2)}</span>
                        </span>
                        <span>
                          <span className="text-slate-500">Side Costs:</span> 
                          <span className="font-medium">€{contract.sideCosts.toFixed(2)}</span>
                        </span>
                        <span>
                          <span className="text-slate-500">Warm Rent:</span> 
                          <span className="font-medium text-emerald-600">€{warmRent.toFixed(2)}</span>
                        </span>
                      </div>
                      
                      {contract.notes && (
                        <p className="mt-2 text-sm text-slate-500">{contract.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => onViewPayments(contract)}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm"
                      title="View Payments"
                    >
                      Payments
                    </button>
                    <button
                      onClick={() => onEdit(contract)}
                      className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm"
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(contract)}
                      className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-500">No contracts found for this tenant</p>
        </div>
      )}
    </div>
  );
};
