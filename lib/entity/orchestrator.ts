import type { EntityTask, TaskResult } from './types'

/** Runs the work for a single task and resolves with its output. */
export type TaskHandler = (task: EntityTask) => Promise<unknown>

export interface OrchestratorOptions {
  /** Maximum number of tasks to run at once. Defaults to 3. */
  concurrency?: number
  /** Checked before scheduling each task; when true, remaining tasks are skipped. */
  isStopped?: () => boolean | Promise<boolean>
  /** Called as each task settles, for real-time progress reporting. */
  onProgress?: (result: TaskResult) => void
}

/**
 * Executes a set of {@link EntityTask}s with bounded concurrency while honouring
 * `dependsOn` ordering.
 *
 * Guarantees:
 * - A failing task never rejects the batch — it is recorded as `failed` and its
 *   dependents are `skipped` (failures handled gracefully).
 * - When the emergency stop engages mid-run, no further tasks start.
 * - Tasks with unsatisfiable dependencies (missing/cyclic) are `skipped`, not
 *   hung.
 */
export class Orchestrator {
  async run(
    tasks: EntityTask[],
    handler: TaskHandler,
    options: OrchestratorOptions = {},
  ): Promise<TaskResult[]> {
    const concurrency = Math.max(1, options.concurrency ?? 3)
    const isStopped = options.isStopped ?? (() => false)

    const results = new Map<string, TaskResult>()
    const succeeded = new Set<string>()
    const finished = new Set<string>()
    const remaining = new Set(tasks.map((t) => t.id))
    const taskById = new Map(tasks.map((t) => [t.id, t]))

    let running = 0
    let stopped = false

    if (tasks.length === 0) return []

    return new Promise<TaskResult[]>((resolve) => {
      const finalize = () => {
        if (finished.size === tasks.length) {
          resolve(tasks.map((t) => results.get(t.id) as TaskResult))
        }
      }

      const skip = (id: string, reason: string) => {
        if (finished.has(id)) return
        const result: TaskResult = {
          taskId: id,
          status: 'skipped',
          output: null,
          error: reason,
          durationMs: 0,
        }
        results.set(id, result)
        finished.add(id)
        remaining.delete(id)
        options.onProgress?.(result)
      }

      const settle = (id: string, result: TaskResult) => {
        results.set(id, result)
        finished.add(id)
        if (result.status === 'success') succeeded.add(id)
        options.onProgress?.(result)
        running -= 1
        void schedule()
      }

      const schedule = async () => {
        if (!stopped && (await isStopped())) {
          stopped = true
          for (const id of Array.from(remaining)) skip(id, 'Emergency stop engaged')
          finalize()
          return
        }
        if (stopped) {
          finalize()
          return
        }

        for (const id of Array.from(remaining)) {
          if (running >= concurrency) break
          const task = taskById.get(id) as EntityTask
          const deps = task.dependsOn ?? []
          const depFailed = deps.some((d) => finished.has(d) && !succeeded.has(d))
          if (depFailed) {
            skip(id, 'Dependency failed')
            continue
          }
          if (!deps.every((d) => succeeded.has(d))) continue

          remaining.delete(id)
          running += 1
          const start = Date.now()
          Promise.resolve(handler(task))
            .then((output) =>
              settle(id, {
                taskId: id,
                status: 'success',
                output,
                error: null,
                durationMs: Date.now() - start,
              }),
            )
            .catch((err) =>
              settle(id, {
                taskId: id,
                status: 'failed',
                output: null,
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - start,
              }),
            )
        }

        // Nothing in flight but tasks remain → their dependencies can never be
        // satisfied (missing or cyclic). Skip them so we don't hang.
        if (running === 0 && remaining.size > 0) {
          for (const id of Array.from(remaining)) skip(id, 'Unresolved dependencies')
        }
        finalize()
      }

      void schedule()
    })
  }
}
