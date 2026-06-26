'use client'

import { useEffect, useRef, useSyncExternalStore, type ComponentType } from 'react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Activity, Brain, ClipboardList, Cog, CircleCheckBig, TriangleAlert, Loader2, Trash2 } from 'lucide-react'
import {
  createNotificationCenter,
  ENTITY_STEPS,
  isActivePhase,
  type EntityNotificationCenter,
  type EntityProgressState,
  type EntityStep,
} from '@/lib/entity/notifications'

type IconType = ComponentType<{ className?: string }>

const STEP_ICONS: Record<EntityStep, IconType> = {
  analyzing: Brain,
  planning: ClipboardList,
  executing: Cog,
  complete: CircleCheckBig,
}

const LEVEL_DOT: Record<string, string> = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
}

/**
 * React binding for the Entity {@link EntityNotificationCenter}. Lazily creates
 * one center per component tree, subscribes the caller to its state through
 * `useSyncExternalStore`, and forwards one-off notifications to toasts. Returns
 * the center so callers can drive phases (`start`/`setPhase`/`complete`/`fail`).
 */
export function useEntityProgress(): {
  center: EntityNotificationCenter
  state: EntityProgressState
} {
  const centerRef = useRef<EntityNotificationCenter | null>(null)
  if (centerRef.current === null) {
    centerRef.current = createNotificationCenter()
  }
  const center = centerRef.current

  const state = useSyncExternalStore(center.subscribe, center.getState, center.getState)

  useEffect(() => {
    return center.subscribeNotifications((notification) => {
      if (notification.level === 'error') toast.error(notification.message)
      else if (notification.level === 'success') toast.success(notification.message)
      else toast(notification.message)
    })
  }, [center])

  return { center, state }
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString()
}

interface EntityProgressProps {
  state: EntityProgressState
  /** When provided, renders a "Clear" button that empties the live log. */
  onClear?: () => void
}

/**
 * Live progress panel for the Entity dashboard: a status line, a progress bar,
 * the Analyzing → Planning → Executing → Complete step tracker, and a running
 * activity log. Purely presentational — state is owned by the notification
 * center via {@link useEntityProgress}.
 */
export function EntityProgress({ state, onClear }: EntityProgressProps) {
  const t = useTranslations('entity.progress')

  const idle = state.phase === 'idle'
  const errored = state.phase === 'error'
  const complete = state.phase === 'complete'
  const active = isActivePhase(state.phase)

  const statusTone = errored
    ? 'text-red-600 dark:text-red-400'
    : complete
      ? 'text-green-600 dark:text-green-400'
      : active
        ? 'text-accent'
        : 'text-gray-500 dark:text-gray-400'

  const barTone = errored ? 'bg-red-500' : complete ? 'bg-green-500' : 'bg-accent'

  return (
    <section
      aria-live="polite"
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className={`h-4 w-4 ${active ? 'text-accent' : 'text-gray-400'}`} />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('title')}</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${statusTone}`}>
          {active && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {errored && <TriangleAlert className="h-3.5 w-3.5" />}
          {complete && <CircleCheckBig className="h-3.5 w-3.5" />}
          {t(`phases.${state.phase}`)}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.percent}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barTone}`}
          style={{ width: `${state.percent}%` }}
        />
      </div>

      {/* Step tracker: Analyzing → Planning → Executing → Complete */}
      <ol className="grid grid-cols-4 gap-2">
        {ENTITY_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step]
          const isCurrent = index === state.stepIndex
          const done = index < state.stepIndex
          const current = isCurrent && active
          const failed = isCurrent && errored

          const circleTone = failed
            ? 'border-red-500 bg-red-50 text-red-600 dark:border-red-500 dark:bg-red-900/20'
            : done
              ? 'border-green-500 bg-green-50 text-green-600 dark:border-green-500 dark:bg-green-900/20'
              : current
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-gray-200 text-gray-400 dark:border-gray-700'

          const labelTone = failed
            ? 'text-red-600 dark:text-red-400'
            : current
              ? 'text-accent'
              : done
                ? 'text-gray-700 dark:text-gray-200'
                : 'text-gray-400'

          return (
            <li key={step} className="flex flex-col items-center gap-1 text-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border ${circleTone}`}
              >
                {current ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : failed ? (
                  <TriangleAlert className="h-4 w-4" />
                ) : done ? (
                  <CircleCheckBig className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span className={`text-[11px] font-medium ${labelTone}`}>{t(`steps.${step}`)}</span>
            </li>
          )
        })}
      </ol>

      {/* Live log */}
      {state.log.length > 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 dark:border-gray-800">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('log.title')}</span>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <Trash2 className="h-3 w-3" /> {t('log.clear')}
              </button>
            )}
          </div>
          <ul className="max-h-40 space-y-1 overflow-auto p-3">
            {state.log.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${LEVEL_DOT[entry.level] ?? 'bg-gray-400'}`}
                />
                <span className="shrink-0 font-mono text-[10px] leading-5 text-gray-400">
                  {formatTime(entry.at)}
                </span>
                <span
                  className={
                    entry.level === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-300'
                  }
                >
                  {entry.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">{idle ? t('idle') : t('log.empty')}</p>
      )}
    </section>
  )
}

export default EntityProgress
