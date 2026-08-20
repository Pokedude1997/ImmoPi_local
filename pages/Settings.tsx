
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { api } from '../services/api';
import { AppSettings, Category, CategoryType } from '../types';
import { Save, CheckCircle2, ListChecks, Plus, Trash2, X, CheckCircle, Loader2, AlertCircle, Pencil } from 'lucide-react';

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings>({ currency: 'EUR', taxYear: new Date().getFullYear() });
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load settings from backend API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoadingSettings(true);
        const loadedSettings = await api.getSettings();
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };
    loadSettings();
  }, []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>(CategoryType.EXPENSE);
  const [newCategoryIsTaxRelevant, setNewCategoryIsTaxRelevant] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [updatingCategory, setUpdatingCategory] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  
  // Edit state for inline editing
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<CategoryType>(CategoryType.EXPENSE);
  const [editIsTaxRelevant, setEditIsTaxRelevant] = useState(false);

  // Load categories from backend API
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        const cats = await api.getCategories();
        setCategories(cats);
      } catch (error) {
        console.error('Failed to load categories:', error);
        setError('Failed to load categories');
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  // Check if a category is in use
  const isCategoryInUse = async (categoryId: string | number): Promise<boolean> => {
    try {
      const [transactions, recurring, documents] = await Promise.all([
        api.getTransactions(),
        api.getRecurringPayments(),
        api.getDocuments()
      ]);
      return (
        transactions.some((t: any) => t.categoryId === categoryId || t.category_id === categoryId) ||
        recurring.some((r: any) => r.categoryId === categoryId || r.category_id === categoryId) ||
        documents.some((d: any) => d.categoryId === categoryId || d.category_id === categoryId)
      );
    } catch (error) {
      console.error('Failed to check category usage:', error);
      return true; // Assume in use if we can't check
    }
  };

  // Add a new category
  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      await api.createCategory({
        name: newCategoryName.trim(),
        type: newCategoryType,
        isTaxRelevant: newCategoryIsTaxRelevant,
      });
      const updatedCategories = await api.getCategories();
      setCategories(updatedCategories);
      // Reset form
      setNewCategoryName('');
      setNewCategoryType(CategoryType.EXPENSE);
      setNewCategoryIsTaxRelevant(false);
      setMsg('Category added successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to add category');
    }
  };

  // Start editing a category
  const handleStartEdit = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditType(category.type);
    setEditIsTaxRelevant(category.isTaxRelevant);
    setError(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditName('');
    setEditType(CategoryType.EXPENSE);
    setEditIsTaxRelevant(false);
  };

  // Save edited category
  const handleSaveEdit = async () => {
    if (!editingCategory || !editName.trim()) {
      setError('Category name is required');
      return;
    }

    setUpdatingCategory(editingCategory.id.toString());
    try {
      await api.updateCategory(editingCategory.id, {
        name: editName.trim(),
        type: editType,
        isTaxRelevant: editIsTaxRelevant,
      });
      const updatedCategories = await api.getCategories();
      setCategories(updatedCategories);
      handleCancelEdit();
      setMsg('Category updated successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to update category');
    } finally {
      setUpdatingCategory(null);
    }
  };

  // Delete a category
  const handleDeleteCategory = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this category? This cannot be undone.')) {
      return;
    }

    setDeletingCategory(id.toString());
    try {
      const inUse = await isCategoryInUse(id);
      if (inUse) {
        setError('Cannot delete: category is used in existing transactions, recurring payments, or documents');
        return;
      }
      await api.deleteCategory(id);
      const updatedCategories = await api.getCategories();
      setCategories(updatedCategories);
      setMsg('Category deleted successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to delete category');
    } finally {
      setDeletingCategory(null);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSettings: AppSettings = {
      ...settings,
      // googleDriveFolderId: formData.get('googleDriveFolderId') as string,
      taxYear: Number(formData.get('taxYear')),
    };
    try {
      await api.updateSettings(newSettings);
      setSettings(newSettings);
      setMsg('General settings updated.');
    } catch (error) {
      console.error('Failed to update settings:', error);
      setMsg('Failed to update settings.');
    }
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
             {/* <Input 
                name="googleDriveFolderId" 
                label="Folder ID / Path" 
                defaultValue={settings.googleDriveFolderId} 
                placeholder="root-folder-identifier"
             /> */}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" className="shadow-lg shadow-blue-100">
              <Save className="w-4 h-4 mr-2" />
              Update Core Settings
            </Button>
          </div>
        </form>
      </Card>
      
      {/* Category Configuration Card */}
      <Card className="p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> Transaction Categories
          </h2>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-100 mb-4">
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Input
            value={newCategoryName}
            onChange={(e) => {
              setNewCategoryName(e.target.value);
              setError(null);
            }}
            placeholder="Category name (e.g., Utilities)"
            required
          />
          <Select
            value={newCategoryType}
            onChange={(e) => setNewCategoryType(e.target.value as CategoryType)}
          >
            <option value={CategoryType.INCOME}>Income</option>
            <option value={CategoryType.EXPENSE}>Expense</option>
          </Select>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newCategoryIsTaxRelevant}
                onChange={(e) => setNewCategoryIsTaxRelevant(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Tax Relevant</span>
            </label>
            <Button type="submit" className="ml-auto" disabled={savingCategory !== null}>
              {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </Button>
          </div>
        </form>

        {/* Category List */}
        <div className="overflow-x-auto">
          {loadingCategories ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-slate-600">Loading categories...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No categories found.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase">Tax</th>
                  <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50">
                    {editingCategory?.id === cat.id ? (
                      // Edit mode
                      <>
                        <td className="px-6 py-4">
                          <Input
                            value={editName}
                            onChange={(e) => {
                              setEditName(e.target.value);
                              setError(null);
                            }}
                            className="text-sm p-1.5"
                            autoFocus
                          />
                        </td>
                        <td className="px-6 py-4">
                          <Select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as CategoryType)}
                            className="text-sm p-1.5"
                          >
                            <option value={CategoryType.INCOME}>Income</option>
                            <option value={CategoryType.EXPENSE}>Expense</option>
                          </Select>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <label className="flex items-center justify-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editIsTaxRelevant}
                              onChange={(e) => setEditIsTaxRelevant(e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                          </label>
                        </td>
                        <td className="px-6 py-4 text-right text-sm space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={updatingCategory === cat.id.toString()}
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            {updatingCategory === cat.id.toString() ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={updatingCategory !== null}
                            className="text-slate-500 hover:text-slate-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </td>
                      </>
                    ) : (
                      // Display mode
                      <>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {cat.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            cat.type === CategoryType.INCOME
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {cat.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {cat.isTaxRelevant ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(cat)}
                            disabled={deletingCategory !== null || updatingCategory !== null}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(cat.id)}
                            disabled={deletingCategory === cat.id.toString() || updatingCategory !== null}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            {deletingCategory === cat.id.toString() ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            Categories are used in transactions, documents, and recurring payments. 
            Categories that are in use cannot be deleted.
          </p>
        </div>
      </Card>
      
      <div className="text-center text-[10px] font-black text-slate-300 tracking-[0.3em] pt-10">
        IMMOPIDB &bull; v1.0.0 &bull; LOCAL_HOST
      </div>
    </div>
  );
};
