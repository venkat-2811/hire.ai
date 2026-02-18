import Groq from 'groq-sdk';

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export async function generateText(
  prompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const client = getGroqClient();

  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
  });

  return completion.choices[0]?.message?.content || '';
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

// Keep backward-compatible exports
export const getGeminiModel = getGroqClient;
