import { createInMemoryEntityStore } from '@/lib/entity/store'
import { SafetyController, EntityStoppedError } from '@/lib/entity/safety'
import { createGitPrExecutor, readActionPatch, isApplicableFix } from '@/lib/entity/apply'
import { getDeploymentStatus } from '@/lib/entity/deploy'
import type { GitClient } from '@/lib/entity/apply'
import type { EntityAction, EntityActor, FixPatch } from '@/lib/entity/types'

const actor: EntityActor = { id: 'admin-1', email: 'admin@example.com' }

const PATCH: FixPatch = {
  commitMessage: 'fix: guard against null client',
  branchName: 'entity/fix-null-client',
  files: [{ path: 'lib/foo.ts', contents: 'export const x = 1\n' }],
}

/** A fake {@link GitClient} that records calls and can be told to fail mid-way. */
class FakeGit implements GitClient {
  calls: string[] = []
  branches = new Set<string>()
  prs: { number: number; branch: string; state: 'open' | 'closed' }[] = []
  failOn: 'putFile' | 'openPullRequest' | null = null
  checkState: 'pending' | 'success' | 'failure' = 'success'
  private nextPr = 100

  async getBaseRef() {
    this.calls.push('getBaseRef')
    return { branch: 'main', sha: 'base-sha' }
  }
  async createBranch(name: string) {
    this.calls.push(`createBranch:${name}`)
    this.branches.add(name)
  }
  async putFile(_branch: string, path: string) {
    this.calls.push(`putFile:${path}`)
    if (this.failOn === 'putFile') throw new Error('putFile boom')
  }
  async openPullRequest(branch: string) {
    this.calls.push('openPullRequest')
    if (this.failOn === 'openPullRequest') throw new Error('pr boom')
    const number = this.nextPr++
    this.prs.push({ number, branch, state: 'open' })
    return { number, url: `https://github.com/acme/app/pull/${number}` }
  }
  async closePullRequest(prNumber: number) {
    this.calls.push(`closePullRequest:${prNumber}`)
    const pr = this.prs.find((p) => p.number === prNumber)
    if (pr) pr.state = 'closed'
  }
  async deleteBranch(name: string) {
    this.calls.push(`deleteBranch:${name}`)
    this.branches.delete(name)
  }
  async getPrChecks() {
    this.calls.push('getPrChecks')
    return { state: this.checkState }
  }
}

function setup() {
  const store = createInMemoryEntityStore()
  const safety = new SafetyController(store, actor)
  return { store, safety }
}

async function approvedFix(
  safety: SafetyController,
  patch?: FixPatch,
): Promise<EntityAction> {
  const pending = await safety.propose({
    module: 'self_healing',
    type: 'healing.fix',
    title: 'Fix proposal',
    summary: 's',
    payload: patch ? { patch } : {},
  })
  // Approve-only (no executor), exactly like the action route does for fixes.
  return safety.approve(pending.id)
}

describe('readActionPatch / isApplicableFix', () => {
  it('accepts a well-formed patch and rejects malformed/absent ones', () => {
    expect(readActionPatch({ payload: { patch: PATCH } })).toMatchObject({
      commitMessage: 'fix: guard against null client',
    })
    expect(readActionPatch({ payload: {} })).toBeUndefined()
    expect(readActionPatch({ payload: { patch: { commitMessage: '', files: [] } } })).toBeUndefined()
    expect(
      readActionPatch({ payload: { patch: { commitMessage: 'x', files: [{ path: '', contents: '' }] } } }),
    ).toBeUndefined()
  })

  it('treats only healing.fix with a patch as applicable', async () => {
    const { safety } = setup()
    const withPatch = await approvedFix(safety, PATCH)
    const withoutPatch = await approvedFix(safety)
    expect(isApplicableFix(withPatch)).toBe(true)
    expect(isApplicableFix(withoutPatch)).toBe(false)
  })
})

describe('createGitPrExecutor', () => {
  it('opens a PR for an approved fix and records the result + rollback state', async () => {
    const { store, safety } = setup()
    const approved = await approvedFix(safety, PATCH)
    const git = new FakeGit()

    const executed = await safety.execute(approved, createGitPrExecutor(git))

    expect(executed.status).toBe('executed')
    expect(executed.result?.prNumber).toBe(100)
    expect(String(executed.result?.prUrl)).toContain('/pull/100')
    const rollback = executed.rollbackState as { prNumber: number; branch: string }
    expect(rollback.prNumber).toBe(100)
    expect(typeof rollback.branch).toBe('string')

    expect(git.calls).toContain('getBaseRef')
    expect(git.calls).toContain('openPullRequest')
    expect(git.calls.some((c) => c.startsWith('createBranch'))).toBe(true)
    expect(git.calls).toContain('putFile:lib/foo.ts')
    expect(store.audit.some((a) => a.action === 'entity.action_executed')).toBe(true)
  })

  it('captures a missing patch as a failed action without touching git', async () => {
    const { safety } = setup()
    const approved = await approvedFix(safety) // no patch
    const git = new FakeGit()

    const failed = await safety.execute(approved, createGitPrExecutor(git))

    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('no applicable patch')
    expect(git.calls).toHaveLength(0)
  })

  it('cleans up the partial branch if applying a file fails mid-way', async () => {
    const { safety } = setup()
    const approved = await approvedFix(safety, PATCH)
    const git = new FakeGit()
    git.failOn = 'putFile'

    const failed = await safety.execute(approved, createGitPrExecutor(git))

    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('putFile boom')
    expect(git.calls.some((c) => c.startsWith('createBranch'))).toBe(true)
    expect(git.calls.some((c) => c.startsWith('deleteBranch'))).toBe(true)
    // No dangling branch left behind.
    expect(git.branches.size).toBe(0)
  })

  it('is blocked by the emergency stop', async () => {
    const { safety } = setup()
    const approved = await approvedFix(safety, PATCH)
    await safety.setEmergencyStop(true)

    await expect(
      safety.execute(approved, createGitPrExecutor(new FakeGit())),
    ).rejects.toBeInstanceOf(EntityStoppedError)
  })

  it('rolls back an applied fix by closing the PR and deleting the branch', async () => {
    const { safety } = setup()
    const approved = await approvedFix(safety, PATCH)
    const git = new FakeGit()
    const executed = await safety.execute(approved, createGitPrExecutor(git))
    const { prNumber, branch } = executed.rollbackState as { prNumber: number; branch: string }

    // The action route performs these two git calls before flipping the status.
    await git.closePullRequest(prNumber)
    await git.deleteBranch(branch)
    const rolledBack = await safety.rollback(executed.id)

    expect(rolledBack.status).toBe('rolled_back')
    expect(git.prs.find((p) => p.number === prNumber)?.state).toBe('closed')
    expect(git.branches.has(branch)).toBe(false)
  })
})

describe('getDeploymentStatus', () => {
  it('reports CI state and never auto-merges or deploys', async () => {
    const git = new FakeGit()
    git.checkState = 'failure'
    const failing = await getDeploymentStatus(git, 100)
    expect(failing.ci).toBe('failure')
    expect(failing.autoMerge).toBe(false)
    expect(failing.autoDeploy).toBe(false)

    git.checkState = 'success'
    const passing = await getDeploymentStatus(git, 100)
    expect(passing.ci).toBe('success')
    expect(passing.message).toContain('human')
  })
})
