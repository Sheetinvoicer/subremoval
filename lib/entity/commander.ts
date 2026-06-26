import type {
  AICaller,
  EntityModule,
  EntityPlan,
  EntityTask,
  PermissionLevel,
} from './types'

/**
 * Stable system prompt (sent with `cache_control` by the Claude caller). It
 * tells the model what SheetInvoicer is, which modules exist, and — crucially —
 * that every task it produces is a proposal for a human to approve.
 */
const SYSTEM_PROMPT = `You are the Commander of SheetInvoicer's operations "Entity".
SheetInvoicer is an invoicing SaaS for freelancers and small businesses (invoices,
estimates, clients, expenses, recurring billing and online payments).

Turn the user's high-level GOAL into a concrete, ordered list of small tasks.
Delegate each task to exactly one module:
- "marketing": draft blog/social/email content (a human approves before anything is published).
- "revenue": analyse metrics and propose pricing/upsell/retention ideas (never applied automatically).
- "self_healing": diagnose an error and propose a fix (never applied to production automatically).
- "orchestrator": coordinate or aggregate the results of other tasks.

Hard rules:
- Every task is a PROPOSAL for a human to review. Nothing executes automatically.
- Never propose tasks that bypass human approval, post to third parties directly,
  move money, or deploy code.

Respond with ONLY a JSON object (no prose, no markdown fences) shaped like:
{"summary":"one sentence","tasks":[{"id":"t1","title":"...","description":"...","module":"marketing|revenue|self_healing|orchestrator","dependsOn":[]}]}`

const MAX_TASKS = 25

/**
 * The Commander: high-level planning brain. It uses Claude to break a goal into
 * tasks but performs no side effects itself — the resulting plan is handed to
 * the Orchestrator, and any task with an external effect becomes an approval.
 */
export class Commander {
  constructor(private readonly ai: AICaller) {}

  async planGoal(goal: string): Promise<EntityPlan> {
    const trimmed = (goal ?? '').trim()
    if (!trimmed) {
      return { goal: '', summary: 'No goal provided.', tasks: [] }
    }
    const raw = await this.ai({
      system: SYSTEM_PROMPT,
      prompt: `GOAL: ${trimmed}`,
      maxTokens: 1500,
    })
    return normalizePlan(trimmed, extractJson(raw))
  }
}

/**
 * Best-effort extraction of a JSON object from a model response. Tolerates code
 * fences and surrounding prose, and never throws — a malformed reply yields an
 * empty object so the caller degrades to an empty plan instead of crashing.
 */
export function extractJson(text: string): Record<string, unknown> {
  if (!text || typeof text !== 'string') return {}
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return {}
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Normalises and validates a parsed plan into a strict {@link EntityPlan}. */
export function normalizePlan(
  goal: string,
  parsed: Record<string, unknown>,
): EntityPlan {
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : `Plan for: ${goal}`
  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
  const tasks: EntityTask[] = rawTasks.slice(0, MAX_TASKS).map((entry, index) => {
    const obj = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
    const taskModule = normalizeModule(obj.module)
    return {
      id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `t${index + 1}`,
      title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : `Task ${index + 1}`,
      description: typeof obj.description === 'string' ? obj.description : '',
      module: taskModule,
      permission: taskPermission(taskModule),
      dependsOn: Array.isArray(obj.dependsOn)
        ? obj.dependsOn.filter((d): d is string => typeof d === 'string')
        : [],
    }
  })
  return { goal, summary, tasks }
}

export function normalizeModule(value: unknown): EntityModule {
  const v = typeof value === 'string' ? value.toLowerCase().trim() : ''
  if (v === 'marketing' || v === 'revenue' || v === 'orchestrator') return v
  if (v === 'self_healing' || v === 'self-healing' || v === 'healing') return 'self_healing'
  return 'orchestrator'
}

/** Representative oversight level for a task delegated to a module. */
function taskPermission(module: EntityModule): PermissionLevel {
  switch (module) {
    case 'marketing':
    case 'revenue':
      return 'medium'
    case 'self_healing':
      return 'high'
    default:
      return 'safe'
  }
}
