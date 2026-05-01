import type { Handler } from '@netlify/functions';
import axios from 'axios';

type ApexResponse = {
  compiled: boolean;
  success: boolean;
  logs: string;
  line?: number;
  column?: number;
  compileProblem?: string;
  exceptionMessage?: string;
  exceptionStackTrace?: string;
  errorType?: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function response(statusCode: number, body: ApexResponse) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return response(405, {
      compiled: false,
      success: false,
      logs: 'Method not allowed. Use POST.',
      errorType: 'method_error',
    });
  }

  try {
    const parsed = JSON.parse(event.body || '{}');
    const code = String(parsed.code || '').trim();
    if (!code) {
      return response(400, {
        compiled: false,
        success: false,
        logs: 'Code is required.',
        errorType: 'validation_error',
      });
    }

    const clientId = process.env.SF_CLIENT_ID;
    const clientSecret = process.env.SF_CLIENT_SECRET;
    const username = process.env.SF_USERNAME;
    const password = process.env.SF_PASSWORD;
    const securityToken = process.env.SF_SECURITY_TOKEN;

    if (!clientId || !clientSecret || !username || !password || !securityToken) {
      return response(500, {
        compiled: false,
        success: false,
        logs: 'Salesforce credentials are not fully configured.',
        errorType: 'config_error',
      });
    }

    const authPayload = new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password: `${password}${securityToken}`,
    });

    const authResp = await axios.post('https://login.salesforce.com/services/oauth2/token', authPayload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 12000,
    });

    const accessToken = authResp.data?.access_token;
    const instanceUrl = authResp.data?.instance_url;
    if (!accessToken || !instanceUrl) {
      return response(502, {
        compiled: false,
        success: false,
        logs: 'Salesforce auth response is missing token or instance URL.',
        errorType: 'auth_error',
      });
    }

    const executeResp = await axios.get(`${instanceUrl}/services/data/v59.0/tooling/executeAnonymous`, {
      params: { anonymousBody: code },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 20000,
    });

    const data = executeResp.data || {};
    const logs = String(data.debugLog || data.logs || data.compileProblem || data.exceptionMessage || '').trim();

    let errorType: string | undefined;
    if (!data.compiled) {
      errorType = 'compile_error';
    } else if (!data.success) {
      const details = `${data.exceptionMessage || ''} ${data.exceptionStackTrace || ''}`.toLowerCase();
      if (details.includes('limitexception') || details.includes('governor')) errorType = 'governor_limit_error';
      else errorType = 'runtime_error';
    }

    return response(200, {
      compiled: Boolean(data.compiled),
      success: Boolean(data.success),
      logs,
      line: data.line,
      column: data.column,
      compileProblem: data.compileProblem,
      exceptionMessage: data.exceptionMessage,
      exceptionStackTrace: data.exceptionStackTrace,
      errorType,
    });
  } catch (error: unknown) {
    const err = error as { isAxiosError?: boolean; message?: string; response?: { status?: number; data?: unknown } };
    const axiosError = err?.isAxiosError ? err : null;
    const status = axiosError?.response?.status;
    const payload = axiosError?.response?.data;
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    const text = `${err?.message || ''} ${payloadString}`.toLowerCase();

    if (status === 400 || status === 401 || status === 403) {
      return response(401, {
        compiled: false,
        success: false,
        logs: 'Salesforce authentication failed. Check OAuth credentials or security token.',
        errorType: 'auth_error',
      });
    }

    if (text.includes('enotfound') || text.includes('timeout') || text.includes('network')) {
      return response(503, {
        compiled: false,
        success: false,
        logs: 'Network error while contacting Salesforce.',
        errorType: 'network_error',
      });
    }

    return response(500, {
      compiled: false,
      success: false,
      logs: 'Unexpected error while executing Apex.',
      errorType: 'execution_error',
    });
  }
};
