import type { AICaller, EntityAction, FixPatch, FixPatchFile } from './types'
import type { SafetyController } from './safety'
import { extractJson } from './commander'

export interface ErrorReport {
  id?: string
  title: string
  message?: string
  stack?: string
  occurrences?: number
  /** Where the error came from, e.g. 'sentry' or 'manual'. */
  source?: string
}

const SYSTEM_PROMPT = `You are SheetInvoicer's reliability engineer. Given a production error,
produce a concise diagnosis and a SUGGESTED fix.

Your output is a PROPOSAL ONLY. You do NOT deploy. A human reviews your
suggestion; if you include a patch, "applying" it opens a pull request that must
pass CI and be merged by a human before it ever ships.

Respond in TWO parts, in this exact order:

PART 1 — a short human-readable review with three labelled sections:
1) Likely root cause
2) Suggested fix (what to change and where)
3) Risk & rollback notes

PART 2 — a line containing only:
---PATCH---
followed by ONLY a single JSON object (no prose, no markdown fences) describing a
machine-applicable patch:
{"commitMessage":"<short message>","branchName":"entity/fix-<slug>","files":[{"path":"<repo-relative path>","contents":"<COMPLETE new file contents>"}]}
Rules for PART 2:
- "contents" MUST be the entire new file, not a diff or a fragment.
- Include a file only if you are confident of its full corrected contents.
- If you cannot produce a safe, complete patch, output {} instead.`

const MAX_STACK_CHARS = 4000
const MAX_PATCH_FILES = 20
const PATCH_DELIMITER = '---PATCH---'

/**
 * Best-effort parse of the PART 2 JSON into a strict {@link FixPatch}. Returns
 * `undefined` (never throws) when the patch is absent or malformed — the action
 * then stays review-only and the dashboard's Apply button is disabled, so a bad
 * patch can never reach a pull request.
 */
export function parseFixPatch(text: string): FixPatch | undefined {
  const parsed = extractJson(text)
  const commitMessage =
    typeof parsed.commitMessage === 'string' ? parsed.commitMessage.trim() : ''
  const rawFiles = Array.isArray(parsed.files) ? parsed.files : []

  const files: FixPatchFile[] = []
  for (const entry of rawFiles.slice(0, MAX_PATCH_FILES)) {
    const obj = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
    const path = typeof obj.path === 'string' ? obj.path.trim() : ''
    const contents = typeof obj.contents === 'string' ? obj.contents : ''
    if (!path || !contents) continue
    files.push({ path, contents })
  }

  if (!commitMessage || files.length === 0) return undefined

  const branchName =
    typeof parsed.branchName === 'string' && parsed.branchName.trim()
      ? parsed.branchName.trim()
      : undefined

  return { commitMessage, branchName, files }
}

/** Splits the AI reply into the human diagnosis and the raw patch JSON section. */
function splitReply(raw: string): { diagnosis: string; patchText: string } {
  const idx = raw.indexOf(PATCH_DELIMITER)
  if (idx === -1) return { diagnosis: raw.trim(), patchText: '' }
  return {
    diagnosis: raw.slice(0, idx).trim(),
    patchText: raw.slice(idx + PATCH_DELIMITER.length),
  }
}

/**
 * Self-healing module. It ingests an error report and produces an AI diagnosis +
 * suggested fix filed as a `high`-permission proposal. It still NEVER edits the
 * running source or deploys: when the AI supplies a valid patch the proposal
 * carries it as structured data, and "applying" it (a separate, human-triggered
 * step) opens a pull request for CI + human merge. This keeps an autonomous
 * code-writing-and-deploy loop out of production.
 */
export class SelfHealing {
  constructor(
    private readonly ai: AICaller,
    private readonly safety: SafetyController,
  ) {}

  async analyze(error: ErrorReport): Promise<EntityAction> {
    const prompt = [
      `Error: ${error.title}`,
      `Message: ${error.message ?? ''}`,
      `Occurrences: ${error.occurrences ?? 1}`,
      `Source: ${error.source ?? 'manual'}`,
      'Stack trace:',
      (error.stack ?? '').slice(0, MAX_STACK_CHARS),
    ].join('\n')

    const raw = await this.ai({ system: SYSTEM_PROMPT, prompt, maxTokens: 4000 })
    const { diagnosis, patchText } = splitReply(raw)
    const patch = parseFixPatch(patchText)

    return this.safety.propose({
      module: 'self_healing',
      type: 'healing.fix',
      title: `Fix proposal — ${error.title}`,
      summary: patch
        ? 'AI diagnosis with a proposed patch. Review, then Apply opens a pull request (CI must pass and a human merges). No code is changed or deployed automatically.'
        : 'AI diagnosis and suggested fix for human review. No code is changed or deployed automatically.',
      payload: {
        error,
        diagnosis,
        ...(patch ? { patch } : {}),
      },
    })
  }
}
