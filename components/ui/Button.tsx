import * as React from 'react'

type Variant = 'primary' | 'secondary'
type Size = 'sm' | 'md' | 'lg'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  /** Show a spinner and disable the button. */
  loading?: boolean
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent/90 hover:shadow-glow border border-transparent',
  secondary:
    'bg-transparent text-text-primary border border-border hover:border-accent/60 hover:bg-surface',
}

/**
 * Design-system button.
 *
 * - `primary`: accent color with hover glow.
 * - `secondary`: ghost style with subtle border.
 * - Built-in `loading` state with spinner.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-button font-medium',
        'transition-all duration-250 focus:outline-none focus:ring-2 focus:ring-accent/50',
        'hover:scale-[1.03] active:scale-95 motion-reduce:transform-none',
        'disabled:opacity-60 disabled:pointer-events-none disabled:hover:scale-100',
        sizeClasses[size],
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
