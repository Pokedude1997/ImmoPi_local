// Shared constants for the application

export const RENT_PAYMENT_STATUS = {
  PAID: 'PAID',
  PENDING: 'PENDING',
  OVERDUE: 'OVERDUE',
} as const;

export const PAYMENT_METHOD = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  CASH: 'CASH',
  OTHER: 'OTHER',
} as const;

// Status display configuration
export const statusColors = {
  [RENT_PAYMENT_STATUS.PAID]: 'bg-emerald-100 text-emerald-800',
  [RENT_PAYMENT_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
  [RENT_PAYMENT_STATUS.OVERDUE]: 'bg-red-100 text-red-800',
};

export const statusLabels = {
  [RENT_PAYMENT_STATUS.PAID]: 'Paid',
  [RENT_PAYMENT_STATUS.PENDING]: 'Pending',
  [RENT_PAYMENT_STATUS.OVERDUE]: 'Overdue',
};

// Payment method display labels
export const paymentMethodLabels = {
  [PAYMENT_METHOD.BANK_TRANSFER]: 'Bank Transfer',
  [PAYMENT_METHOD.CASH]: 'Cash',
  [PAYMENT_METHOD.OTHER]: 'Other',
};

// Date formatting utilities
export const formatDate = (dateString: string, options?: Intl.DateTimeFormatOptions): string => {
  return new Date(dateString).toLocaleDateString(undefined, options);
};

export const formatDateFull = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateShort = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

export const formatCurrency = (amount: number): string => {
  return `€${amount.toFixed(2)}`;
};
