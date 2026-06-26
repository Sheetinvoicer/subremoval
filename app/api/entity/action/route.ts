import { NextResponse } from 'next/server'
import { requireRole, ROLES } from '@/lib/auth/roles-server'
import { createEntity, createGitHubClient, createGitPrExecutor, readActionPatch } from '@/lib/entity'
import { actorFromUser, entityErrorResponse } from '@/lib/entity/route-helpers'
import type { GitRollbackState } from '@/lib/entity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → decide on a proposed action. Every decision is audited.
// - `approve`  records the human approval. Code fixes (`healing.fix`) stay
//              `approved` so a separate, explicit `apply` step exists; other
//              action types keep their effect-free executor.
// - `apply`    runs the Git executor for an approved code fix → opens a PR
//              (CI runs the tests; a human merges; Vercel deploys on merge).
// - `reject`   blocks a pending action.
// - `rollback` reverts an executed action; for an applied fix it also closes the
//              pull request and deletes its branch.
export async function POST(request: Request) {
  const access = await requireRole(ROLES.ADMIN)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const actionId = typeof body?.actionId === 'string' ? body.actionId : ''
    const decision = typeof body?.decision === 'string' ? body.decision : ''
    if (!actionId) {
      return NextResponse.json({ error: 'An actionId is required.' }, { status: 400 })
    }

    const entity = createEntity({ actor: actorFromUser(access.user) })

    if (decision === 'approve') {
      const existing = await entity.store.getAction(actionId)
      // Code fixes become approve-only so the explicit Apply step can run later.
      if (existing?.type === 'healing.fix') {
        return NextResponse.json({ action: await entity.safety.approve(actionId) })
      }
      const action = await entity.safety.approve(actionId, async (current) => ({
        result: {
          approvedAt: new Date().toISOString(),
          note: 'Approved by admin. Any external effect (publishing, billing, code deploy) remains a manual human step.',
        },
        rollbackState: { previousStatus: current.status, previousPermission: current.permission },
      }))
      return NextResponse.json({ action })
    }

    if (decision === 'apply') {
      const action = await entity.store.getAction(actionId)
      if (!action) {
        return NextResponse.json({ error: `Action ${actionId} not found.` }, { status: 404 })
      }
      if (action.type !== 'healing.fix') {
        return NextResponse.json(
          { error: 'Only code-fix proposals can be applied.' },
          { status: 400 },
        )
      }
      if (action.status !== 'approved') {
        return NextResponse.json(
          { error: 'Approve the fix before applying it.' },
          { status: 400 },
        )
      }
      if (!readActionPatch(action)) {
        return NextResponse.json(
          { error: 'This fix has no applicable patch; review and resolve it manually.' },
          { status: 400 },
        )
      }
      // createGitHubClient throws a clear error if GITHUB_* is unconfigured;
      // safety.execute routes through the emergency stop and records the result.
      const executor = createGitPrExecutor(createGitHubClient())
      return NextResponse.json({ action: await entity.safety.execute(action, executor) })
    }

    if (decision === 'reject') {
      return NextResponse.json({ action: await entity.safety.reject(actionId) })
    }

    if (decision === 'rollback') {
      const action = await entity.store.getAction(actionId)
      // For an applied code fix, close the PR + delete the branch before the
      // SafetyController flips the action to `rolled_back`.
      if (action?.type === 'healing.fix' && action.rollbackState) {
        const { prNumber, branch } = action.rollbackState as Partial<GitRollbackState>
        if (typeof prNumber === 'number' || typeof branch === 'string') {
          const git = createGitHubClient()
          if (typeof prNumber === 'number') await git.closePullRequest(prNumber)
          if (typeof branch === 'string') await git.deleteBranch(branch)
        }
      }
      return NextResponse.json({ action: await entity.safety.rollback(actionId) })
    }

    return NextResponse.json(
      { error: 'decision must be one of: approve, apply, reject, rollback.' },
      { status: 400 },
    )
  } catch (error) {
    return entityErrorResponse(error, 'Failed to update action')
  }
}
