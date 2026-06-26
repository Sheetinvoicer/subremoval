// Tests for the admin-AI health/diagnostics layer (lib/ai/admin.ts).
//
// These lock in:
//   1. getAdminAiHealth reports env-var presence as booleans only (never the
//      secret values) and classifies status as ok / degraded / error.
//   2. An optional live probe validates the service-role key and reports a
//      reachable=false + error message when Supabase rejects the credentials.
//   3. A credential failure (Supabase "Invalid API key") on a critical table is
//      raised as an AdminConfigError so routes can answer 503, not 500.

const mockCreateClient = jest.fn()

jest.mock('@anthropic-ai/sdk', () => jest.fn())
jest.mock('openai', () => ({ OpenAI: jest.fn() }))
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => mockCreateClient(...args),
}))

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

describe('admin AI health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    delete process.env.OPENAI_API_KEY
  })

  it('reports ok with only booleans (no secret values) when fully configured', async () => {
    const { getAdminAiHealth } = loadAdmin()

    const health = await getAdminAiHealth()

    expect(health.ok).toBe(true)
    expect(health.status).toBe('ok')
    expect(health.supabase).toEqual({ url: true, serviceRoleKey: true, reachable: null, error: null })
    expect(health.ai).toEqual({ anthropic: true, openai: false, available: true })
    expect(health.missing).toEqual([])
    // No secret values must ever leak into the payload.
    expect(JSON.stringify(health)).not.toContain(SERVICE_KEY)
    expect(JSON.stringify(health)).not.toContain('sk-ant-test')
  })

  it('is degraded (not error) when no AI key is configured but Supabase is set', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const { getAdminAiHealth } = loadAdmin()

    const health = await getAdminAiHealth()

    expect(health.ok).toBe(true)
    expect(health.status).toBe('degraded')
    expect(health.ai.available).toBe(false)
    expect(health.missing).toContain('ANTHROPIC_API_KEY|OPENAI_API_KEY')
  })

  it('is error and lists missing Supabase vars when they are absent', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { getAdminAiHealth } = loadAdmin()

    const health = await getAdminAiHealth()

    expect(health.ok).toBe(false)
    expect(health.status).toBe('error')
    expect(health.missing).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('probe=true reports reachable=false with the error when the key is invalid', async () => {
    mockCreateClient.mockReturnValue(
      makeClient({ users: { data: null, error: { message: 'Invalid API key' } } })
    )
    const { getAdminAiHealth } = loadAdmin()

    const health = await getAdminAiHealth({ probe: true })

    expect(health.ok).toBe(false)
    expect(health.status).toBe('error')
    expect(health.supabase.reachable).toBe(false)
    expect(health.supabase.error).toMatch(/invalid api key/i)
  })

  it('probe=true reports reachable=true when Supabase accepts the key', async () => {
    mockCreateClient.mockReturnValue(makeClient({ users: { data: [], error: null, count: 0 } }))
    const { getAdminAiHealth } = loadAdmin()

    const health = await getAdminAiHealth({ probe: true })

    expect(health.supabase.reachable).toBe(true)
    expect(health.ok).toBe(true)
  })
})

describe('admin AI credential-error classification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY
  })

  it('raises AdminConfigError (not a plain Error) on an "Invalid API key" users failure', async () => {
    mockCreateClient.mockReturnValue(
      makeClient({
        users: { data: null, error: { message: 'Invalid API key' } },
        invoices: { data: [], error: null },
      })
    )
    const { gatherAdminContext, AdminConfigError } = loadAdmin()

    await expect(gatherAdminContext()).rejects.toBeInstanceOf(AdminConfigError)
  })

  it('keeps a non-credential failure as a generic Error', async () => {
    mockCreateClient.mockReturnValue(
      makeClient({
        users: { data: [], error: null },
        invoices: { data: null, error: { message: 'relation "invoices" does not exist' } },
      })
    )
    const { gatherAdminContext, AdminConfigError } = loadAdmin()

    const rejection = await gatherAdminContext().catch((error) => error)
    expect(rejection).toBeInstanceOf(Error)
    expect(rejection).not.toBeInstanceOf(AdminConfigError)
  })
})
