import React, { useState } from 'react';
import { Card, Button, Input, Select } from '../components/ui';
import { db } from '../services/storage';
import { analyzeDocumentWithGemini, AIAnalysisResult } from '../services/geminiService';
import { AppDocument, DocumentType, Property, Category } from '../types';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export const Documents = () => {
  const [documents, setDocuments] = useState<AppDocument[]>(db.getDocuments());
  const [isUploading, setIsUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [showReview, setShowReview] = useState(false);
  
  const properties = db.getProperties();
  const categories = db.getCategories();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    setCurrentFile(file);
    setIsUploading(true);
    setAnalysisResult(null);

    try {
      if (process.env.API_KEY) {
        const result = await analyzeDocumentWithGemini(file);
        setAnalysisResult(result);
      } else {
         // Mock for demo if no key env var
         console.warn("No API_KEY in env, using mock data");
         setTimeout(() => {
          setAnalysisResult({
            documentType: DocumentType.INVOICE,
            date: new Date().toISOString().split('T')[0],
            amount: 0,
            currency: 'EUR',
            counterpartyName: '',
            summary: 'Scanned Document (No AI Key configured)',
            suggestedCategoryName: 'Uncategorized'
          });
        }, 1500);
      }
    } catch (err) {
      alert("AI Analysis failed. Please check your internet connection.");
    }
    
    setIsUploading(false);
    setShowReview(true);
  };

  const handleSaveDocument = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (!currentFile) return;

    const newDoc: Omit<AppDocument, 'id'> = {
      fileName: currentFile.name,
      mimeType: currentFile.type,
      uploadDate: new Date().toISOString(),
      documentDate: formData.get('date') as string,
      documentType: formData.get('type') as DocumentType,
      amount: Number(formData.get('amount')),
      currency: formData.get('currency') as string,
      propertyId: formData.get('propertyId') as string,
      categoryId: formData.get('categoryId') as string,
      notes: formData.get('summary') as string,
      googleDriveId: 'mock-drive-id-' + Math.random(), // Mock
    };

    const savedDoc = db.saveDocument(newDoc);
    
    // Auto-create transaction option? For now just save doc.
    if (confirm("Document saved! Do you want to create a linked Transaction automatically?")) {
      db.saveTransaction({
        type: categories.find(c => c.id === newDoc.categoryId)?.type || 'Expense' as any,
        propertyId: newDoc.propertyId || properties[0]?.id || '',
        categoryId: newDoc.categoryId || categories[0].id,
        amount: newDoc.amount || 0,
        currency: newDoc.currency,
        date: newDoc.documentDate || new Date().toISOString(),
        description: newDoc.notes || `Transaction for ${newDoc.fileName}`,
        documentId: savedDoc.id
      });
    }

    setDocuments(db.getDocuments());
    setShowReview(false);
    setCurrentFile(null);
    setAnalysisResult(null);
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
        <div className="relative">
          <input 
            type="file" 
            id="doc-upload" 
            className="hidden" 
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <label htmlFor="doc-upload">
            <Button as="span" className="cursor-pointer" disabled={isUploading}>
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {isUploading ? 'Analyzing...' : 'Upload & Analyze'}
            </Button>
          </label>
        </div>
      </div>

      {showReview && analysisResult && (
        <Card className="p-6 border-blue-200 bg-blue-50">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-white rounded-lg text-blue-600 shadow-sm">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900">Review AI Analysis</h3>
              <p className="text-blue-700 text-sm">Please verify the extracted data before saving.</p>
            </div>
          </div>

          <form onSubmit={handleSaveDocument} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input name="date" type="date" label="Document Date" defaultValue={analysisResult.date} required />
            <div className="grid grid-cols-2 gap-2">
              <Input name="amount" type="number" step="0.01" label="Amount" defaultValue={analysisResult.amount} required />
              <Input name="currency" label="Currency" defaultValue={analysisResult.currency} required />
            </div>
            
            <Select name="type" label="Document Type" defaultValue={analysisResult.documentType}>
               {Object.values(DocumentType).map(t => <option key={t} value={t}>{t}</option>)}
            </Select>

            <Select name="categoryId" label="Category">
               <option value="">Select Category...</option>
               {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </Select>

            <Select name="propertyId" label="Property">
               <option value="">Select Property...</option>
               {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>

            <div className="md:col-span-2">
               <Input name="summary" label="Description / Notes" defaultValue={analysisResult.summary} />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 mt-4">
              <Button type="button" variant="ghost" onClick={() => setShowReview(false)}>Cancel</Button>
              <Button type="submit">Confirm & Save</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {documents.map(doc => (
          <Card key={doc.id} className="p-4 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-100 rounded-lg text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">{doc.fileName}</h4>
                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                  <span>{new Date(doc.uploadDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span>•</span>
                  <span>{doc.documentType}</span>
                  {doc.amount && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-slate-700">{doc.amount} {doc.currency}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="text-xs" onClick={() => alert("In a real app, this would open the Google Drive link: " + doc.googleDriveId)}>
                View Drive
              </Button>
            </div>
          </Card>
        ))}
        {documents.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p>No documents uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};