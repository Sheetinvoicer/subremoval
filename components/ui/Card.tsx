import * as React from 'react'

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Enable the subtle accent glow on hover. */
  hoverGlow?: boolean
}

/**
 * Glassmorphism dark card.
 *
 * - Translucent dark surface with a subtle border.
 * - Optional accent glow on hover.
 */
export default function Card({
  className = '',
  hoverGlow = true,
  children,
  ...props
}: CardProps) {
  const hover = hoverGlow
    ? 'hover:border-accent/60 hover:shadow-glow hover:-translate-y-1 motion-reduce:hover:translate-y-0'
    : ''

  return (
    <div
      className={[
        'rounded-card border border-border bg-card/70 backdrop-blur-md',
        'shadow-card p-6 transition-all duration-250',
        hover,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}
