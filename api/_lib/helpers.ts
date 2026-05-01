/**
 * Shared response helpers, CORS, auth wrapper, rate limiter, and URL utilities.
 * Extracted verbatim from api/[...path].ts — lines 938-970, 496-519, 649-666, 5942-5951.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyClerkToken } from './clerk';

// ── Response helpers ──────────────────────────────────────────────────────────

export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function ok(res: VercelResponse, body: unknown, status = 200) {
  return res.status(status).json(body);
}

export function badRequest(res: VercelResponse, message: string) {
  return res.status(400).json({ error: message });
}

export function notFound(res: VercelResponse, message = 'Not found') {
  return res.status(404).json({ error: message });
}

export function methodNotAllowed(res: VercelResponse) {
  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Auth wrapper ──────────────────────────────────────────────────────────────

export async function requireAuth(req: VercelRequest, res: VercelResponse) {
  try {
    return await verifyClerkToken(req);
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

// ── UUID helper ───────────────────────────────────────────────────────────────

import crypto from 'node:crypto';
export function uuidv4(): string { return crypto.randomUUID(); }

// ── URL helpers ───────────────────────────────────────────────────────────────

export function normalizeBaseUrl(u: string): string {
  return String(u || '').trim().replace(/\/+$/, '');
}

export function resolveFrontendBaseUrl(req: VercelRequest): string {
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  const isLocalhost = String(hostHeader || '').includes('localhost');
  const protocol = req.headers['x-forwarded-proto']
    ? String(req.headers['x-forwarded-proto']).split(',')[0]
    : (isLocalhost ? 'http' : 'https');
  const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : 'https://hiretec.netlify.app';

  let frontendUrl = process.env.FRONTEND_URL;
  if (
    !frontendUrl ||
    frontendUrl === 'http://localhost:8080' ||
    frontendUrl === 'http://localhost:5173' ||
    frontendUrl.includes('hire-ai-sandy')
  ) {
    frontendUrl = dynamicUrl;
  }

  return normalizeBaseUrl(frontendUrl);
}

export function getFrontendBaseUrl(req: any): string {
  const normalize = (u: string) => String(u || '').replace(/\/+$/, '');

  const explicit = normalize(process.env.FRONTEND_URL || '');
  if (explicit) return explicit;

  const origin = normalize((req.headers?.origin as string) || '');
  if (origin) return origin;

  const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
  const isLocalhost = String(hostHeader || '').includes('localhost');
  const protocol = req.headers['x-forwarded-proto']
    ? String(req.headers['x-forwarded-proto']).split(',')[0]
    : (isLocalhost ? 'http' : 'https');

  const dynamicUrl = hostHeader ? `${protocol}://${hostHeader}` : '';
  return normalize(dynamicUrl || 'https://hire-ai-sandy.vercel.app');
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

const _submissionTimestamps: Record<string, number[]> = {};
export function checkRateLimit(sessionId: string, maxPerMinute: number = 10): boolean {
  const now = Date.now();
  const cutoff = now - 60000;
  const stamps = (_submissionTimestamps[sessionId] || []).filter(t => t > cutoff);
  stamps.push(now);
  _submissionTimestamps[sessionId] = stamps;
  return stamps.length <= maxPerMinute;
}
