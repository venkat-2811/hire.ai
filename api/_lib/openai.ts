/**
 * OpenAI client and generation utilities.
 * Extracted verbatim from api/[...path].ts — lines 570-619.
 */
import OpenAI from 'openai';

let _openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const k = process.env.OPENAI_API_KEY;
    if (!k) throw new Error('OPENAI_API_KEY not configured');
    _openai = new OpenAI({ apiKey: k });
  }
  return _openai;
}

export async function generateText(prompt: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  });
  return completion.choices[0]?.message?.content || '';
}

export async function generateJSON<T>(prompt: string, opts?: { maxTokens?: number; temperature?: number }): Promise<T> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that ONLY responds with valid JSON. No markdown, no code blocks, no explanation - just the JSON object or array.' },
      { role: 'user', content: prompt },
    ],
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxTokens ?? 8192,
    response_format: { type: 'json_object' },
  });
  const text = (completion.choices[0]?.message?.content || '').trim();
  if (!text) throw new Error('Empty AI response');
  try { return JSON.parse(text) as T; }
  catch (e) {
    let jsonStr = text;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const arrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (arrayMatch) jsonStr = arrayMatch[0];
    else if (objectMatch && !jsonStr.startsWith('[')) jsonStr = objectMatch[0];
    try { return JSON.parse(jsonStr) as T; }
    catch (e2) {
      console.error('JSON parse error. Raw text:', text.slice(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }
  }
}
