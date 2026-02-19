/**
 * API Client - All backend communication goes through here
 * Replaces localStorage with backend API calls
 */

import {
  Property,
  Tenant,
  Category,
  AppDocument,
  Transaction,
  RecurringPayment,
  AppSettings,
  Counterparty,
} from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Get authentication token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    // Token expired or invalid - redirect to login
    localStorage.removeItem('authToken');
    localStorage.removeItem('authExpiry');
    window.location.href = '/#/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

/**
 * API Service - All backend operations
 */
export const api = {
  // ============================================================================
  // PROPERTIES
  // ============================================================================
  async getProperties(): Promise<Property[]> {
    return apiRequest<Property[]>('/properties');
  },

  async getProperty(id: string | number): Promise<Property> {
    return apiRequest<Property>(`/properties/${id}`);
  },

  async createProperty(data: Omit<Property, 'id'>): Promise<Property> {
    return apiRequest<Property>('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProperty(id: string | number, data: Partial<Property>): Promise<Property> {
    return apiRequest<Property>(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProperty(id: string | number): Promise<void> {
    return apiRequest<void>(`/properties/${id}`, {
      method: 'DELETE',
    });
  },

  // ============================================================================
  // TENANTS
  // ============================================================================
  async getTenants(): Promise<Tenant[]> {
    return apiRequest<Tenant[]>('/tenants');
  },

  async createTenant(data: Omit<Tenant, 'id'>): Promise<Tenant> {
    return apiRequest<Tenant>('/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTenant(id: string | number, data: Partial<Tenant>): Promise<Tenant> {
    return apiRequest<Tenant>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTenant(id: string | number): Promise<void> {
    return apiRequest<void>(`/tenants/${id}`, {
      method: 'DELETE',
    });
  },

  // ============================================================================
  // CATEGORIES
  // ============================================================================
  async getCategories(): Promise<Category[]> {
    return apiRequest<Category[]>('/categories');
  },

  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    return apiRequest<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCategory(id: string | number, data: Partial<Category>): Promise<Category> {
    return apiRequest<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteCategory(id: string | number): Promise<void> {
    return apiRequest<void>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // ============================================================================
  // TRANSACTIONS
  // ============================================================================
  async getTransactions(): Promise<Transaction[]> {
    return apiRequest<Transaction[]>('/transactions');
  },

  async createTransaction(data: Omit<Transaction, 'id'>): Promise<Transaction> {
    return apiRequest<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTransaction(id: string | number, data: Partial<Transaction>): Promise<Transaction> {
    return apiRequest<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTransaction(id: string | number): Promise<void> {
    return apiRequest<void>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  },

  // ============================================================================
  // DOCUMENTS
  // ============================================================================
  async getDocuments(): Promise<AppDocument[]> {
    return apiRequest<AppDocument[]>('/documents');
  },

  async getDocument(id: string | number): Promise<AppDocument> {
    return apiRequest<AppDocument>(`/documents/${id}`);
  },

  /**
   * Upload and analyze document
   * Returns document metadata with Drive file ID
   */
  async uploadDocument(
    file: File,
    propertyId?: string | number,
    notes?: string
  ): Promise<{
    success: boolean;
    documentId: number;
    driveFileId: string;
    driveLink: string;
    folderPath: string;
    aiData: any;
    validationErrors?: any[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    if (propertyId) formData.append('propertyId', propertyId.toString());
    if (notes) formData.append('notes', notes);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/documents/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Upload failed',
      }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  },

  async deleteDocument(id: string | number): Promise<void> {
    return apiRequest<void>(`/documents/${id}`, {
      method: 'DELETE',
    });
  },

  // ============================================================================
  // RECURRING PAYMENTS
  // ============================================================================
  async getRecurringPayments(): Promise<RecurringPayment[]> {
    return apiRequest<RecurringPayment[]>('/recurring-payments');
  },

  async createRecurringPayment(data: Omit<RecurringPayment, 'id'>): Promise<RecurringPayment> {
    return apiRequest<RecurringPayment>('/recurring-payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateRecurringPayment(
    id: string | number,
    data: Partial<RecurringPayment>
  ): Promise<RecurringPayment> {
    return apiRequest<RecurringPayment>(`/recurring-payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteRecurringPayment(id: string | number): Promise<void> {
    return apiRequest<void>(`/recurring-payments/${id}`, {
      method: 'DELETE',
    });
  },

  // ============================================================================
  // COUNTERPARTIES
  // ============================================================================
  async getCounterparties(): Promise<Counterparty[]> {
    return apiRequest<Counterparty[]>('/counterparties');
  },

  async createCounterparty(data: Omit<Counterparty, 'id'>): Promise<Counterparty> {
    return apiRequest<Counterparty>('/counterparties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCounterparty(
    id: string | number,
    data: Partial<Counterparty>
  ): Promise<Counterparty> {
    return apiRequest<Counterparty>(`/counterparties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteCounterparty(id: string | number): Promise<void> {
    return apiRequest<void>(`/counterparties/${id}`, {
      method: 'DELETE',
    });
  },

  // ============================================================================
  // SETTINGS
  // ============================================================================
  async getSettings(): Promise<AppSettings> {
    return apiRequest<AppSettings>('/settings');
  },

  async updateSettings(data: AppSettings): Promise<AppSettings> {
    return apiRequest<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ============================================================================
  // BACKUP
  // ============================================================================
  async triggerBackup(): Promise<{ success: boolean; message: string; details: any }> {
    return apiRequest('/backup/manual', {
      method: 'POST',
    });
  },
};
