
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Settings, QuotationData } from '../types';

let aiInstance: GoogleGenAI | null = null;

function getApiKey(): string {
  try {
    const API_KEY = import.meta.env.VITE_GOOGLE_GEMINI_API_KEY || '';
    return API_KEY;
  } catch (e) {
    console.warn("[Gemini Service] Error accessing API key");
    return '';
  }
}

function getAiClient(): GoogleGenAI | null {
    if (aiInstance) return aiInstance;
    const API_KEY = getApiKey();
    if (API_KEY && API_KEY !== '' && !API_KEY.includes('PLACEHOLDER')) {
        aiInstance = new GoogleGenAI({ apiKey: API_KEY });
        return aiInstance;
    }
    return null;
}

const generateMockQuotation = (inputText: string, settings: Settings) => {
    const sqmMatch = inputText.match(/(\d+)\s*m2/i);
    const mockSqm = sqmMatch ? parseFloat(sqmMatch[1]) : 50;

    return {
        clientDetails: {
            clientName: "Test Client (Local Mode)",
            clientAddress: "123 Localhost Ave",
            clientPhone: "0800-LOCAL-TEST",
            projectName: "Sample Tiling Project",
        },
        tiles: [
            {
                category: "Floor Tiles (Mock)",
                group: "Living Room",
                cartons: Math.ceil(mockSqm / 1.5),
                sqm: mockSqm,
                size: settings.defaultSittingRoomSize,
                tileType: "Floor",
                unitPrice: settings.sittingRoomTilePrice,
            }
        ],
        materials: [
            { item: "Cement", quantity: Math.ceil(mockSqm / 5), unit: "bags", unitPrice: settings.cementPrice, calculationLogic: "1 bag per 5m2" },
            { item: "White Cement", quantity: 2, unit: "bags", unitPrice: settings.whiteCementPrice, calculationLogic: "Approx 1 bag per 30m2" }
        ],
        adjustments: [],
        checklist: [
            { item: "Surface preparation", checked: true },
            { item: "Tile alignment check", checked: false },
            { item: "Grouting", checked: false }
        ],
        workmanshipRate: settings.workmanshipRate,
        maintenance: 0,
        profitPercentage: 10,
        depositPercentage: settings.defaultDepositPercentage,
        termsAndConditions: settings.defaultTermsAndConditions,
        proTips: ["Ensure floor is level before starting", "Large tiles require double buttering"]
    };
};

async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        resolve('');
      }
    };
    reader.readAsDataURL(file);
  });
  const data = await base64EncodedDataPromise;
  return {
    inlineData: { data, mimeType: file.type },
  };
}

export const getTextFromImageAI = async (imageFile: File): Promise<string> => {
    try {
        const ai = getAiClient();
        if (!ai) return "Mock OCR Text:\nSitting Room 60m2\nKitchen 15m2\nCement 10 bags";
        const imagePart = await fileToGenerativePart(imageFile);
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [
                imagePart,
                { text: "Extract all handwritten or printed text from this tiling job note. Return only the extracted text." }
            ]},
        });
        return response.text?.trim() || "";
    } catch (error) {
        return "Failed to read image. Please type notes manually.";
    }
};

export const analyzeSiteConditionsAI = async (imageFile: File): Promise<string> => {
    try {
        const ai = getAiClient();
        if (!ai) return "AI Site Vision disabled in guest mode.";
        const imagePart = await fileToGenerativePart(imageFile);
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [
                imagePart,
                { text: "Act as a senior tiler. Analyze this site photo. List any potential issues (uneven floors, cracks, damp) and suggested prep materials." }
            ]},
        });
        return response.text?.trim() || "No issues detected.";
    } catch (error) {
        return "Analysis failed.";
    }
};

const quotationSchema = {
    type: Type.OBJECT,
    properties: {
        clientDetails: {
            type: Type.OBJECT,
            properties: {
                clientName: { type: Type.STRING },
                clientAddress: { type: Type.STRING },
                clientPhone: { type: Type.STRING },
                projectName: { type: Type.STRING },
            },
            required: ['clientName', 'clientAddress', 'clientPhone', 'projectName']
        },
        tiles: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING },
                    group: { type: Type.STRING },
                    cartons: { type: Type.NUMBER },
                    sqm: { type: Type.NUMBER },
                    size: { type: Type.STRING },
                    tileType: { type: Type.STRING }, 
                    unitPrice: { type: Type.NUMBER },
                },
                required: ['category', 'group', 'cartons', 'sqm', 'size', 'tileType', 'unitPrice']
            }
        },
        materials: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    item: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    unitPrice: { type: Type.NUMBER },
                    calculationLogic: { type: Type.STRING },
                },
                required: ['item', 'quantity', 'unit', 'unitPrice']
            }
        },
        adjustments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                },
                required: ['description', 'amount']
            }
        },
        checklist: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    item: { type: Type.STRING },
                    checked: { type: Type.BOOLEAN }
                },
                required: ['item', 'checked']
            }
        },
        workmanshipRate: { type: Type.NUMBER },
        maintenance: { type: Type.NUMBER },
        profitPercentage: { type: Type.NUMBER },
        depositPercentage: { type: Type.NUMBER },
        termsAndConditions: { type: Type.STRING },
        proTips: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ['clientDetails', 'tiles', 'materials', 'checklist', 'adjustments', 'workmanshipRate', 'maintenance', 'profitPercentage', 'depositPercentage', 'termsAndConditions', 'proTips']
};

export const generateQuotationFromAI = async (inputText: string, settings: Settings, addCheckmateDefault: boolean, showChecklistDefault: boolean): Promise<any> => {
    const ai = getAiClient();
    if (!ai) {
        await new Promise(r => setTimeout(r, 1000));
        return generateMockQuotation(inputText, settings);
    }

    const sizePriceRules = settings.tilePricesBySize?.map(r => `* Size "${r.size}" -> ${r.price} NGN`).join('\n') || '';

    const prompt = `
        You are "Tiling Quotation Formatter & Calculator AI".
        Convert this text into a professional quotation JSON.
        Input: "${inputText}"
        Rules:
        1. Units: SR=Sitting, TW=Toilet Wall, etc.
        2. Pricing: ${sizePriceRules}. Default Workmanship: ${settings.workmanshipRate}.
        3. Materials: Sugest cement, grout, and adhesive based on total SQM.
        4. Calculation Logic: In the 'materials' array, explain HOW you got the quantity (e.g., '1 bag per 4m2 based on area').
        5. Pro Tips: Add 2-3 professional technical tips for this specific project.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quotationSchema as any,
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        return generateMockQuotation(inputText, settings);
    }
};

export const refineQuotationAI = async (currentData: QuotationData, instruction: string): Promise<QuotationData> => {
    const ai = getAiClient();
    if (!ai) return currentData;

    const prompt = `
        Update the following tiling quotation JSON based on this instruction: "${instruction}".
        Keep the JSON structure identical.
        Current JSON: ${JSON.stringify(currentData)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quotationSchema as any,
            }
        });
        return { ...currentData, ...JSON.parse(response.text.trim()) };
    } catch (error) {
        console.error("Refinement failed", error);
        return currentData;
    }
};

export const getAiSummaryForTts = async (data: QuotationData, totalAmount: number): Promise<string> => {
    try {
        const ai = getAiClient();
        if (!ai) return `Summary: Total cost is ${totalAmount} Naira.`;
        const prompt = `Summarize this quote for ${data.clientDetails.clientName} for project ${data.clientDetails.projectName}. Total: ${totalAmount}. Max 50 words.`;
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        return response.text || "Summary unavailable.";
    } catch (error) {
        return "Failed to generate summary.";
    }
};

export const generateSpeechFromText = async (text: string): Promise<string> => {
    try {
        const ai = getAiClient();
        if (!ai) return "";
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
            },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
    } catch (error) {
        return "";
    }
};
