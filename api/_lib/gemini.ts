import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

let geminiModel: GenerativeModel | null = null;

export function getGeminiModel(): GenerativeModel {
  if (!geminiModel) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  return geminiModel;
}

export async function generateText(
  prompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const model = getGeminiModel();
  
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2048,
    },
  });

  const response = result.response;
  return response.text();
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  const text = await generateText(prompt, { temperature: 0.3 });
  
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                    text.match(/```\s*([\s\S]*?)\s*```/) ||
                    [null, text];
  
  const jsonStr = jsonMatch[1] || text;
  
  try {
    return JSON.parse(jsonStr.trim()) as T;
  } catch (error) {
    console.error('Failed to parse JSON response:', jsonStr);
    throw new Error('Failed to parse AI response as JSON');
  }
}
