import type { GitClient } from './apply'

export type CiState = 'pending' | 'success' | 'failure'

/**
 * Read-only deployment/CI status for an applied fix's pull request.
 *
 * This intentionally reports status only. The Entity NEVER merges a PR or
 * triggers a deploy: CI runs the tests on the PR, a human reviews and merges,
 * and Vercel deploys on merge. `autoMerge`/`autoDeploy` are always `false` to
 * make that guarantee explicit in the data the dashboard renders.
 */
export interface DeploymentStatus {
  prNumber: number
  ci: CiState
  autoMerge: false
  autoDeploy: false
  message: string
}

function messageForState(state: CiState): string {
  switch (state) {
    case 'success':
      return 'CI passed. A human can review and merge the PR; Vercel deploys on merge.'
    case 'failure':
      return 'CI failed. The PR must be fixed before a human can merge it.'
    default:
      return 'CI is still running. Wait for checks to finish before merging.'
  }
}

/**
 * Reports the CI/merge status of the pull request opened for an applied fix.
 * Never merges or deploys — that stays a human action on a green PR.
 */
export async function getDeploymentStatus(
  git: GitClient,
  prNumber: number,
): Promise<DeploymentStatus> {
  const checks = await git.getPrChecks(prNumber)
  return {
    prNumber,
    ci: checks.state,
    autoMerge: false,
    autoDeploy: false,
    message: messageForState(checks.state),
  }
}
