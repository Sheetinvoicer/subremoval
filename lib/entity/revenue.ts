import type { AICaller, EntityAction } from './types'
import type { SafetyController } from './safety'

export interface RevenueMetrics {
  mrr?: number
  activeSubscriptions?: number
  newCustomers30d?: number
  churnedCustomers30d?: number
  totalRevenue?: number
  pendingRevenue?: number
  overdueInvoices?: number
}

export interface RevenueReport {
  generatedAt: string
  metrics: RevenueMetrics
  derived: {
    arpu: number
    churnRate: number
    netNewCustomers: number
  }
  insights: string[]
}

const SYSTEM_PROMPT = `You are SheetInvoicer's revenue analyst. Given SaaS metrics, propose up
to three concrete, low-risk revenue actions (pricing tweak, upsell, retention
play). Be specific and conservative. These are RECOMMENDATIONS only — a human
decides whether to act, and nothing changes pricing or bills any customer
automatically.`

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Revenue module. `analyze` is a pure, deterministic computation of headline
 * metrics; `recommend` optionally enriches it with AI suggestions filed as a
 * `medium`-permission proposal. No pricing or billing change is ever applied
 * automatically (those would be `high` actions requiring explicit approval).
 */
export class Revenue {
  constructor(
    private readonly ai: AICaller,
    private readonly safety: SafetyController,
  ) {}

  analyze(metrics: RevenueMetrics): RevenueReport {
    const mrr = num(metrics.mrr)
    const subs = num(metrics.activeSubscriptions)
    const churned = num(metrics.churnedCustomers30d)
    const created = num(metrics.newCustomers30d)
    const overdue = num(metrics.overdueInvoices)

    const arpu = subs > 0 ? mrr / subs : 0
    const churnRate = subs + churned > 0 ? churned / (subs + churned) : 0

    const insights: string[] = []
    if (overdue > 0) {
      insights.push(`${overdue} overdue invoice(s) — automated reminders could recover this revenue.`)
    }
    if (churnRate > 0.05) {
      insights.push(`Monthly churn is ${(churnRate * 100).toFixed(1)}%, above a healthy ~5% threshold.`)
    }
    if (arpu > 0) {
      insights.push(`ARPU is ${arpu.toFixed(2)}; an annual plan or add-on could lift it.`)
    }
    if (created - churned < 0) {
      insights.push('Net new customers are negative this period — acquisition or retention needs attention.')
    }
    if (insights.length === 0) {
      insights.push('Metrics look healthy. Keep monitoring weekly.')
    }

    return {
      generatedAt: new Date().toISOString(),
      metrics,
      derived: { arpu, churnRate, netNewCustomers: created - churned },
      insights,
    }
  }

  async recommend(report: RevenueReport): Promise<EntityAction> {
    const prompt = [
      'Metrics (derived):',
      JSON.stringify(report.derived),
      '',
      'Observed insights:',
      ...report.insights.map((i) => `- ${i}`),
      '',
      'Propose up to 3 concrete revenue actions.',
    ].join('\n')

    const recommendations = await this.ai({ system: SYSTEM_PROMPT, prompt, maxTokens: 800 })

    return this.safety.propose({
      module: 'revenue',
      type: 'revenue.recommendation',
      title: 'Revenue recommendations',
      summary: 'AI-suggested revenue actions for your review. Nothing is priced or billed automatically.',
      payload: {
        recommendations,
        derived: report.derived,
        insights: report.insights,
      },
    })
  }
}
