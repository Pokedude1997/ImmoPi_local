// import { DocumentType } from '../types';

// export interface AIAnalysisResult {
//   documentType: DocumentType;
//   date: string;
//   amount: number;
//   currency: 'CHF' | 'EUR' | 'USD';
//   counterpartyName: string;
//   summary: string;
//   suggestedCategoryName: string;
// }

// function inferDocumentType(fileName: string): DocumentType {
//   const lowerName = fileName.toLowerCase();
//   if (lowerName.includes('invoice')) return DocumentType.INVOICE;
//   if (lowerName.includes('receipt')) return DocumentType.RECEIPT;
//   if (lowerName.includes('contract')) return DocumentType.CONTRACT;
//   if (lowerName.includes('utility') || lowerName.includes('bill')) return DocumentType.UTILITY_BILL;
//   if (lowerName.includes('tax')) return DocumentType.TAX_STATEMENT;
//   return DocumentType.OTHER;
// }

// function inferCurrency(fileName: string): 'CHF' | 'EUR' | 'USD' {
//   const lowerName = fileName.toLowerCase();
//   if (lowerName.includes('chf')) return 'CHF';
//   if (lowerName.includes('usd')) return 'USD';
//   return 'EUR';
// }

// export async function analyzeDocumentWithGemini(file: File): Promise<AIAnalysisResult> {
//   const documentType = inferDocumentType(file.name);
//   const currency = inferCurrency(file.name);
//   const date = new Date().toISOString().split('T')[0];
//
//   return new Promise((resolve) => {
//     window.setTimeout(() => {
//       resolve({
//         documentType,
//         date,
//         amount: 0,
//         currency,
//         counterpartyName: '',
//         summary: `Simulated analysis for ${file.name}`,
//         suggestedCategoryName: 'Uncategorized',
//       });
//     }, 1200);
//   });
// }
