/**
 * Netlify Function — Universal API adapter
 *
 * This file wraps the same handler that runs on Vercel (`api/[...path].ts`).
 * It translates the Netlify HandlerEvent interface into a Vercel-compatible
 * req/res shape, then delegates to the shared handler.
 *
 * Route: ALL /api/* requests are redirected here by netlify.toml
 */
import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { Readable } from 'stream';

// ─── Import the shared handler ────────────────────────────────────────────────
// `api/[...path].ts` uses `export default` so we import the default export.
// esbuild (which Netlify uses to bundle functions) resolves import paths literally
// and has no issue with the `[` `]` characters in the filename.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – TS language server may warn on the bracket chars; runtime & esbuild are fine
import vercelHandler from '../../api/[...path]';

// ─── Request adapter ──────────────────────────────────────────────────────────

function buildMockRequest(event: HandlerEvent): NodeJS.ReadableStream & Record<string, unknown> {
  // Reconstruct the query string from Netlify's parsed parameters
  const qsEntries = Object.entries(event.queryStringParameters || {});
  const rawQuery = qsEntries.map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`).join('&');

  const urlPath = event.path || '/';

  // Build req.query — Vercel catch-all sets req.query.path (array of segments).
  // routeRequest() in the handler also parses req.url directly, so we just
  // need a plain map of key → value | value[] here.
  const query: Record<string, string | string[]> = {};
  const searchParams = new URLSearchParams(rawQuery);
  searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing !== undefined) {
      query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      query[key] = value;
    }
  });
  // Match Vercel catch-all: req.query.path = ['assessments', 'start', 'abc']
  query.path = urlPath.replace(/^\/api\/?/, '').split('/').filter(Boolean);

  // Parse body (Netlify delivers it as a string or base64)
  let body: unknown = {};
  const contentTypeHeader = Object.entries(event.headers || {})
    .find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';
  const isMultipart = contentTypeHeader.toLowerCase().includes('multipart');

  if (event.body && !isMultipart) {
    try {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
      body = JSON.parse(raw);
    } catch {
      body = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
    }
  }

  // Create a Readable stream from the body so req.pipe(busboy) works for
  // multipart file uploads (e.g. resume uploads).
  const readable = new Readable({ read() {} });
  if (event.body) {
    const buf = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'utf-8');
    readable.push(buf);
  }
  readable.push(null);

  // Normalize header keys to lowercase (Vercel does this; Netlify may send mixed case)
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(event.headers || {})) {
    headers[k.toLowerCase()] = v ?? undefined;
  }

  // Merge stream + request properties so req.method, req.url, etc. work
  return Object.assign(readable, {
    method: event.httpMethod,
    url: urlPath + (rawQuery ? `?${rawQuery}` : ''),
    headers,
    query,
    body,
  }) as NodeJS.ReadableStream & Record<string, unknown>;
}

// ─── Response adapter ─────────────────────────────────────────────────────────

function buildMockResponse() {
  let statusCode = 200;
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
  let responseBody = '';

  // The mock object shape must satisfy every method the handler calls on `res`
  const res: Record<string, unknown> = {
    statusCode,

    status(code: number) {
      statusCode = code;
      return res;
    },

    setHeader(name: string, value: string | string[]) {
      headers[name] = Array.isArray(value) ? value.join(', ') : value;
      return res;
    },

    getHeader(name: string) {
      return headers[name];
    },

    removeHeader(name: string) {
      delete headers[name];
    },

    json(data: unknown) {
      headers['Content-Type'] = 'application/json';
      responseBody = JSON.stringify(data);
      return res;
    },

    send(data: unknown) {
      if (typeof data === 'string') responseBody = data;
      else if (Buffer.isBuffer(data)) responseBody = (data as Buffer).toString();
      else responseBody = JSON.stringify(data);
      return res;
    },

    end(data?: string) {
      if (data) responseBody = data;
      return res;
    },

    // Some code paths call write() for chunked responses
    write(data: string) {
      responseBody += data;
      return true;
    },
  };

  return {
    res,
    getResponse: () => ({ statusCode, headers, body: responseBody }),
  };
}

// ─── Netlify Handler ──────────────────────────────────────────────────────────

const netlifyApiHandler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  // Fast path: CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  const req = buildMockRequest(event);
  const { res, getResponse } = buildMockResponse();

  try {
    await vercelHandler(req as any, res as any);
  } catch (err: any) {
    console.error('[Netlify fn] Unhandled handler error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: err?.message ?? 'Internal server error',
        hint: 'Check Netlify function logs.',
      }),
    };
  }

  return getResponse();
};

export { netlifyApiHandler as handler };
