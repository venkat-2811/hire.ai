/**
 * AssemblyAI transcription service.
 * Extracted verbatim from api/[...path].ts — lines 522-568.
 */

export async function transcribeWithAssemblyAI(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY is not configured in Vercel environment variables.');

  // 1. Upload audio
  const uploadResp = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/octet-stream' },
    body: audioBuffer as unknown as any,
  });
  if (!uploadResp.ok) {
    const errText = await uploadResp.text();
    throw new Error(`AssemblyAI upload failed (${uploadResp.status}): ${errText}`);
  }
  const { upload_url } = await uploadResp.json() as { upload_url: string };
  if (!upload_url) throw new Error('AssemblyAI upload failed: missing upload_url');

  // 2. Create transcript
  const transcriptResp = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, speech_models: ['universal-3-pro', 'universal-2'], language_detection: true }),
  });
  if (!transcriptResp.ok) {
    const errText = await transcriptResp.text();
    throw new Error(`AssemblyAI transcript create failed (${transcriptResp.status}): ${errText}`);
  }
  const { id: transcriptId } = await transcriptResp.json() as { id: string };
  if (!transcriptId) throw new Error('AssemblyAI transcript create failed: missing id');

  // 3. Poll until complete (max 120s)
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollResp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: apiKey },
    });
    if (!pollResp.ok) {
      const errText = await pollResp.text();
      throw new Error(`AssemblyAI poll failed (${pollResp.status}): ${errText}`);
    }
    const pollData = await pollResp.json() as { status: string; text?: string; error?: string };
    if (pollData.status === 'completed') return pollData.text || '';
    if (pollData.status === 'error') throw new Error(`AssemblyAI transcription error: ${pollData.error}`);
  }
  throw new Error('AssemblyAI transcription timed out after 120 seconds');
}
