import * as React from 'react'

type BadgeVariant =
  | 'default'
  | 'accent'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline'

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface text-text-secondary border border-border',
  accent: 'bg-accent/15 text-accent border border-accent/30',
  secondary:
    'bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/30',
  // Status colors: readable tint + text in both light and dark themes.
  success:
    'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/40',
  warning:
    'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/40',
  danger:
    'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40',
  outline: 'bg-transparent text-text-secondary border border-border',
}

/**
 * Small status / label badge — useful for plan status, labels and tags.
 */
export default function Badge({
  variant = 'default',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5',
        'text-xs font-medium transition-colors duration-250',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </span>
  )
}
