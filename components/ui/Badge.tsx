import * as React from 'react'

type BadgeVariant =
  | 'default'
  | 'accent'
  | 'secondary'
  | 'success'
  | 'outline'

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface text-text-secondary border border-border',
  accent: 'bg-accent/15 text-accent border border-accent/30',
  secondary:
    'bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/30',
  success: 'bg-success/15 text-success border border-success/30',
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
