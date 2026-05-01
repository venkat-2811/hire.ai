/**
 * Multipart file parsing and resume text extraction.
 * Extracted verbatim from api/[...path].ts — lines 63-135.
 */
import type { VercelRequest } from '@vercel/node';
import Busboy from 'busboy';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function parseMultipartSingleFile(
  req: VercelRequest,
  fieldName: string,
): Promise<{ filename: string; mimeType: string; buffer: Buffer } | null> {
  return await new Promise((resolve, reject) => {
    try {
      const bb = Busboy({ headers: req.headers as Record<string, string> });
      let done = false;

      let out: { filename: string; mimeType: string; buffer: Buffer } | null = null;

      bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
        if (name !== fieldName) {
          file.resume();
          return;
        }

        const chunks: Buffer[] = [];
        file.on('data', (d: Buffer) => chunks.push(Buffer.from(d)));
        file.on('limit', () => {
          // If limits are set (we don't currently), treat it as error
        });
        file.on('end', () => {
          out = {
            filename: info.filename || 'resume',
            mimeType: info.mimeType || 'application/octet-stream',
            buffer: Buffer.concat(chunks),
          };
        });
      });

      bb.on('error', (err: Error) => {
        if (done) return;
        done = true;
        reject(err);
      });

      bb.on('finish', () => {
        if (done) return;
        done = true;
        resolve(out);
      });

      req.pipe(bb);
    } catch (e) {
      reject(e);
    }
  });
}

export async function extractResumeText(fileBuffer: Buffer, filename: string): Promise<string> {
  const lower = (filename || '').toLowerCase();

  // pdf
  if (lower.endsWith('.pdf')) {
    const parsed = await pdfParse(fileBuffer);
    return String(parsed.text || '');
  }

  // docx
  if (lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return String(result.value || '');
  }

  // doc: not reliably parseable without heavier tooling; fail fast
  if (lower.endsWith('.doc')) {
    throw new Error('Unsupported resume format .doc. Please upload PDF or DOCX.');
  }

  throw new Error('Unsupported resume format. Please upload PDF or DOCX.');
}
