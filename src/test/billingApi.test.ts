import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { billingApi, setAuthTokenGetter } from '@/lib/api';

describe('billingApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    setAuthTokenGetter(async () => 'test-token');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('calls subscribe endpoint with plan payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, session_id: 'cs_test', checkout_url: 'https://checkout', plan: 'pro', deposit_amount: 36.13 }),
    });

    const result = await billingApi.subscribe('pro');

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, config] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/billing/subscribe');
    expect(config.method).toBe('POST');
    expect(config.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(config.body)).toEqual({ plan: 'pro' });
  });

  it('calls usage endpoint with GET', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        plan: 'free',
        status: 'active',
        wallet_balance: 0,
        deposit_amount: 0,
        overage_amount: 0,
        overage_cap: 0,
        billing_cycle_start: '2026-01-01T00:00:00.000Z',
        billing_cycle_end: '2026-01-31T00:00:00.000Z',
        limits: { free_caps: {}, feature_costs: {} },
        usage_breakdown: {},
        usage_total_cost: 0,
      }),
    });

    const result = await billingApi.usage();

    expect(result.plan).toBe('free');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, config] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/billing/usage');
    expect(config.method).toBe('GET');
  });

  it('calls pay-invoice endpoint with invoice id payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, session_id: 'cs_invoice', checkout_url: 'https://checkout' }),
    });

    const result = await billingApi.payInvoice('invoice-123');

    expect(result.success).toBe(true);
    const [url, config] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/billing/pay-invoice');
    expect(config.method).toBe('POST');
    expect(JSON.parse(config.body)).toEqual({ invoice_id: 'invoice-123' });
  });
});
