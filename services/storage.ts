/**
 * @deprecated
 * This file is DEPRECATED. The application now uses a backend API with SQLite database.
 * All data storage should go through the api.ts service layer, not localStorage.
 * This file is kept only for reference and should not be used in new code.
 * 
 * DO NOT USE: db.get*, db.save*, or any functions from this module.
 * USE INSTEAD: api.get* and api.create* from '../services/api' 
 */

import {
  Property,
  Tenant,
  Category,
  AppDocument,
  Transaction,
  RecurringPayment,
  AppSettings,
  CategoryType,
} from '../types';

const STORAGE_KEY = 'immopi_data_v1';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'category-rent-warm', name: 'Rent (Warm)', type: 'Income' as CategoryType, isTaxRelevant: true },
  { id: 'category-rent-cold', name: 'Rent (Cold)', type: 'Income' as CategoryType, isTaxRelevant: true },
  { id: 'category-side-costs', name: 'Side Costs', type: 'Income' as CategoryType, isTaxRelevant: true },
  { id: 'category-maintenance', name: 'Maintenance / Repairs', type: 'Expense' as CategoryType, isTaxRelevant: true },
  { id: 'category-hoa', name: 'Hausgeld (HOA Fee)', type: 'Expense' as CategoryType, isTaxRelevant: true },
  { id: 'category-electricity', name: 'Electricity', type: 'Expense' as CategoryType, isTaxRelevant: true },
  { id: 'category-internet-phone', name: 'Internet/Phone', type: 'Expense' as CategoryType, isTaxRelevant: true },
  { id: 'category-property-tax', name: 'Property Tax', type: 'Expense' as CategoryType, isTaxRelevant: true },
  { id: 'category-insurance', name: 'Insurance', type: 'Expense' as CategoryType, isTaxRelevant: true },
  { id: 'category-mortgage-interest', name: 'Mortgage Interest', type: 'Expense' as CategoryType, isTaxRelevant: true },
  { id: 'category-mortgage-principal', name: 'Mortgage Principal', type: 'Expense' as CategoryType, isTaxRelevant: false },
];

const DEFAULT_SETTINGS: AppSettings = {
  // googleDriveFolderId: '',
  currency: 'EUR',
  taxYear: new Date().getFullYear(),
};

interface StorageData {
  properties: Property[];
  tenants: Tenant[];
  categories: Category[];
  transactions: Transaction[];
  documents: AppDocument[];
  recurringPayments: RecurringPayment[];
  settings: AppSettings;
}

function generateId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStorage(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const data: StorageData = parsed && typeof parsed === 'object' ? parsed : {
      properties: [],
      tenants: [],
      categories: [],
      transactions: [],
      documents: [],
      recurringPayments: [],
      settings: { ...DEFAULT_SETTINGS },
    };

    if (!Array.isArray(data.categories) || data.categories.length === 0) {
      data.categories = [...DEFAULT_CATEGORIES];
    }

    data.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };

    return data;
  } catch (error) {
    const fallback: StorageData = {
      properties: [],
      tenants: [],
      categories: [...DEFAULT_CATEGORIES],
      transactions: [],
      documents: [],
      recurringPayments: [],
      settings: { ...DEFAULT_SETTINGS },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function saveStorage(data: StorageData): StorageData {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

const db = {
  getProperties(): Property[] {
    console.error('DEPRECATED: storage.ts db.getProperties() should not be used. Use api.getProperties() from api.ts instead.');
    return loadStorage().properties;
  },

  saveProperty(property: Omit<Property, 'id'> & { id?: string }): Property {
    const data = loadStorage();
    const id = property.id || generateId('property_');
    const saved: Property = { ...property, id };

    const existingIndex = data.properties.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      data.properties[existingIndex] = saved;
    } else {
      data.properties.push(saved);
    }

    saveStorage(data);
    return saved;
  },

  deleteProperty(id: string) {
    const data = loadStorage();
    data.properties = data.properties.filter((item) => item.id !== id);
    saveStorage(data);
  },

  getTenants(): Tenant[] {
    return loadStorage().tenants;
  },

  saveTenant(tenant: Omit<Tenant, 'id'> & { id?: string }): Tenant {
    const data = loadStorage();
    const id = tenant.id || generateId('tenant_');
    const saved: Tenant = { ...tenant, id };

    const existingIndex = data.tenants.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      data.tenants[existingIndex] = saved;
    } else {
      data.tenants.push(saved);
    }

    saveStorage(data);
    return saved;
  },

  deleteTenant(id: string) {
    const data = loadStorage();
    data.tenants = data.tenants.filter((item) => item.id !== id);
    saveStorage(data);
  },

  getCategories(): Category[] {
    return loadStorage().categories;
  },

  getTransactions(): Transaction[] {
    return loadStorage().transactions;
  },

  saveTransaction(transaction: Omit<Transaction, 'id'> & { id?: string }): Transaction {
    const data = loadStorage();
    const id = transaction.id || generateId('transaction_');
    const saved: Transaction = {
      ...transaction,
      id,
      currency: transaction.currency || 'EUR',
      amount: Number(transaction.amount) || 0,
      isAutoGenerated: transaction.isAutoGenerated || false,
    };

    const existingIndex = data.transactions.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      data.transactions[existingIndex] = saved;
    } else {
      data.transactions.push(saved);
    }

    saveStorage(data);
    return saved;
  },

  deleteTransaction(id: string) {
    const data = loadStorage();
    data.transactions = data.transactions.filter((item) => item.id !== id);
    saveStorage(data);
  },

  getDocuments(): AppDocument[] {
    return loadStorage().documents;
  },

  saveDocument(document: Omit<AppDocument, 'id'> & { id?: string }): AppDocument {
    const data = loadStorage();
    const id = document.id || generateId('document_');
    const saved: AppDocument = {
      ...document,
      id,
      currency: document.currency || 'EUR',
    };

    const existingIndex = data.documents.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      data.documents[existingIndex] = saved;
    } else {
      data.documents.push(saved);
    }

    saveStorage(data);
    return saved;
  },

  getRecurringPayments(): RecurringPayment[] {
    return loadStorage().recurringPayments;
  },

  saveRecurringPayment(payment: Omit<RecurringPayment, 'id'> & { id?: string }): RecurringPayment {
    const data = loadStorage();
    const id = payment.id || generateId('recurring_');
    const nextDueDate = payment.nextDueDate || payment.startDate || new Date().toISOString().split('T')[0];
    const saved: RecurringPayment = {
      ...payment,
      id,
      nextDueDate,
      active: payment.active ?? true,
    };

    const existingIndex = data.recurringPayments.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      data.recurringPayments[existingIndex] = saved;
    } else {
      data.recurringPayments.push(saved);
    }

    saveStorage(data);
    return saved;
  },

  deleteRecurringPayment(id: string) {
    const data = loadStorage();
    data.recurringPayments = data.recurringPayments.filter((item) => item.id !== id);
    saveStorage(data);
  },

  getSettings(): AppSettings {
    return loadStorage().settings;
  },

  saveSettings(settings: AppSettings): AppSettings {
    const data = loadStorage();
    data.settings = {
      ...data.settings,
      ...settings,
    };
    saveStorage(data);
    return data.settings;
  },

  syncMortgageTransactions(property: Property, year: number): string[] {
    const data = loadStorage();
    if (!property.mortgage || !property.mortgage.startDate) {
      return [];
    }

    const logs: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(property.mortgage.startDate);
    if (isNaN(startDate.getTime())) {
      return [];
    }

    const annualTotalRate = (property.mortgage.interestRate + property.mortgage.principalRate) / 100;
    const monthlyPayment = (property.mortgage.loanAmount * annualTotalRate) / 12;
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const yearEnd = new Date(year, 11, 31);

    while (current <= yearEnd) {
      const paymentDate = property.mortgage.paymentTiming === 'END_OF_MONTH'
        ? new Date(current.getFullYear(), current.getMonth() + 1, 0)
        : new Date(current.getFullYear(), current.getMonth(), 1);

      if (paymentDate.getFullYear() === year && paymentDate <= today) {
        const date = paymentDate.toISOString().split('T')[0];
        const exists = data.transactions.some((tx) =>
          tx.propertyId === property.id &&
          tx.isAutoGenerated &&
          tx.date === date &&
          tx.description?.includes('Mortgage payment')
        );

        if (!exists) {
          data.transactions.push({
            id: generateId('mortgage_'),
            type: CategoryType.EXPENSE,
            propertyId: property.id,
            categoryId: 'category-mortgage-interest',
            amount: Number(monthlyPayment.toFixed(2)),
            currency: 'EUR',
            date,
            description: `Mortgage payment for ${property.name}`,
            isAutoGenerated: true,
          });
          logs.push(`Mortgage payment created for ${property.name} on ${date}`);
        }
      }

      current.setMonth(current.getMonth() + 1);
    }

    saveStorage(data);
    return logs;
  },
};

export { db };
