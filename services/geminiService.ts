
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType } from "../types";

export interface AIAnalysisResult {
  documentType: DocumentType;
  date: string;
  amount: number;
  currency: string;
  counterpartyName: string;
  summary: string;
  suggestedCategoryName: string;
}

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeDocumentWithGemini = async (
  file: File
): Promise<AIAnalysisResult | null> => {
  // Always use process.env.API_KEY directly for initialization.
  if (!process.env.API_KEY) {
    console.warn("No Gemini API key provided in environment variables.");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imagePart = await fileToGenerativePart(file);

    const prompt = `
      Analyze this real estate document (invoice, receipt, contract, etc.).
      Extract the following information in JSON format:
      - documentType: One of 'Invoice', 'Receipt', 'Contract', 'Utility Bill', 'Tax Statement', 'Other'
      - date: Document date in YYYY-MM-DD format
      - amount: Total amount (number)
      - currency: Currency code (e.g., EUR)
      - counterpartyName: Name of the vendor, tenant, or entity
      - summary: A short description of the content
      - suggestedCategoryName: A likely category name for real estate accounting (e.g., 'Rent', 'Maintenance', 'Electricity')
    `;

    // Updated model to gemini-3-flash-preview for text and image extraction tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [imagePart, { text: prompt }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            counterpartyName: { type: Type.STRING },
            summary: { type: Type.STRING },
            suggestedCategoryName: { type: Type.STRING },
          },
        },
      },
    });

    // Access the text property directly on the response.
    const text = response.text;
    if (!text) return null;
    
    return JSON.parse(text) as AIAnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Failed", error);
    throw error;
  }
};
