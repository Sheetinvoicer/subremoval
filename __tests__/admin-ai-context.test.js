// Tests for the admin-AI data layer (lib/ai/admin.ts).
//
// These lock in the three guarantees the admin AI relies on:
//   1. It connects with SUPABASE_SERVICE_ROLE_KEY (so RLS is bypassed).
//   2. gatherAdminContext returns every invoice the query yields, and
//      computeMetrics reflects them (admin sees *all* invoices, not its own).
//   3. A failed invoices/users query surfaces as an error instead of silently
//      degrading to empty data (so the AI never reports a false "empty").

const mockCreateClient = jest.fn()

// The admin lib imports the model SDKs at module load; stub them so importing
// the lib in jsdom is cheap and side-effect free (no network clients built).
jest.mock('@anthropic-ai/sdk', () => jest.fn())
jest.mock('openai', () => ({ OpenAI: jest.fn() }))

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => mockCreateClient(...args),
}))

// Build a fake Supabase client whose query builder is awaitable at any depth,
// so both `.select().order().limit()` and the head-count `.select(id,{count})`
// chains resolve to the per-table result we configure.
function makeClient(resultsByTable) {
  return {
    from: (table) => {
      const result = resultsByTable[table] || { data: [], error: null, count: 0 }
      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: () => builder,
        then: (resolve) => resolve(result),
      }
      return builder
    },
  }
}

const SUPABASE_URL = 'https://example.supabase.co'
const SERVICE_KEY = 'service-role-key-xyz'

function loadAdmin() {
  let mod
  jest.isolateModules(() => {
    mod = require('@/lib/ai/admin')
  })
  return mod
}

describe('admin AI data layer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY
  })

  it('connects with the service-role key so RLS is bypassed', async () => {
    mockCreateClient.mockReturnValue(makeClient({}))
    const { gatherAdminContext } = loadAdmin()

    await gatherAdminContext()

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    const [url, key] = mockCreateClient.mock.calls[0]
    expect(url).toBe(SUPABASE_URL)
    expect(key).toBe(SERVICE_KEY)
  })

  it('returns every invoice the query yields and computeMetrics counts them all', async () => {
    const invoices = [
      { id: 'i1', user_id: 'u1', total: 100, status: 'paid', created_at: '2026-06-01', due_date: null, paid_at: '2026-06-02' },
      { id: 'i2', user_id: 'u2', total: 50, status: 'overdue', created_at: '2026-06-03', due_date: '2026-06-04', paid_at: null },
      { id: 'i3', user_id: 'u3', total: 30, status: 'draft', created_at: '2026-06-05', due_date: '2020-01-01', paid_at: null },
    ]
    mockCreateClient.mockReturnValue(
      makeClient({
        users: { data: [{ id: 'u1', email: 'a@x.com', role: 'admin', created_at: '2026-06-01' }], error: null },
        invoices: { data: invoices, error: null },
        clients: { count: 13, error: null },
        expenses: { data: [{ amount: 10 }, { amount: 20 }], error: null },
        audit_logs: { data: [], error: null },
      })
    )
    const { gatherAdminContext, computeMetrics } = loadAdmin()

    const ctx = await gatherAdminContext()
    expect(ctx.invoices).toHaveLength(3)

    const metrics = computeMetrics(ctx)
    expect(metrics.totalInvoices).toBe(3)
    expect(metrics.paidInvoices).toBe(1)
    expect(metrics.overdueInvoices).toBe(1) // 'draft' is excluded even though past due
    expect(metrics.totalRevenue).toBe(100)
    expect(metrics.pendingRevenue).toBe(80)
    expect(metrics.totalClients).toBe(13)
    expect(metrics.totalExpenses).toBe(30)
  })

  it('surfaces an error when the invoices query fails (never a silent empty)', async () => {
    mockCreateClient.mockReturnValue(
      makeClient({
        users: { data: [], error: null },
        invoices: { data: null, error: { message: 'permission denied for table invoices' } },
      })
    )
    const { gatherAdminContext } = loadAdmin()

    await expect(gatherAdminContext()).rejects.toThrow(/invoices/i)
  })

  it('throws a clear error when the service-role env vars are missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { gatherAdminContext } = loadAdmin()

    await expect(gatherAdminContext()).rejects.toThrow(/admin environment variables/i)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('reports plan distribution from the subscriptions.plan column (Free/Pro/Business/Enterprise)', async () => {
    mockCreateClient.mockReturnValue(
      makeClient({
        users: {
          data: [
            { id: 'u1', email: 'a@x.com', role: 'admin', created_at: '2026-06-01' },
            { id: 'u2', email: 'b@x.com', role: 'viewer', created_at: '2026-06-01' },
            { id: 'u3', email: 'c@x.com', role: 'viewer', created_at: '2026-06-01' },
          ],
          error: null,
        },
        invoices: { data: [], error: null },
        // 'business' (lowercase) must normalize to the canonical 'Business' tier;
        // u3 has no row and must fall back to Free.
        subscriptions: {
          data: [
            { user_id: 'u1', plan: 'Pro', status: 'active' },
            { user_id: 'u2', plan: 'business', status: 'active' },
          ],
          error: null,
        },
      })
    )
    const { gatherAdminContext, computeMetrics } = loadAdmin()

    const ctx = await gatherAdminContext()
    const metrics = computeMetrics(ctx)

    expect(metrics.usersByPlan).toEqual({ Free: 1, Pro: 1, Business: 1, Enterprise: 0 })
    expect(metrics.paidSubscriptions).toBe(2)
  })

  it('a failed subscriptions query is non-fatal (logged, not thrown)', async () => {
    mockCreateClient.mockReturnValue(
      makeClient({
        users: { data: [{ id: 'u1', role: 'admin', created_at: '2026-06-01' }], error: null },
        invoices: { data: [], error: null },
        subscriptions: { data: null, error: { message: 'permission denied for table subscriptions' } },
      })
    )
    const { gatherAdminContext, computeMetrics } = loadAdmin()

    const ctx = await gatherAdminContext()
    // Missing subscription data must not break metrics; the lone user is Free.
    expect(computeMetrics(ctx).usersByPlan.Free).toBe(1)
  })

  it('degrades to a deterministic report/answer (no 500) when no AI key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    mockCreateClient.mockReturnValue(
      makeClient({
        users: { data: [{ id: 'u1', email: 'a@x.com', role: 'admin', created_at: '2026-06-01' }], error: null },
        invoices: { data: [], error: null },
        subscriptions: { data: [], error: null },
      })
    )
    const { generateAdminReport, askAdminAI } = loadAdmin()

    const report = await generateAdminReport()
    expect(report).toContain('## Overview')
    expect(report).toMatch(/AI model unavailable/i)

    const answer = await askAdminAI('how many users are there?')
    expect(answer).toMatch(/Users:/)
  })
})
