const paddingClasses = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' };

export function Card({
  children,
  hover = false,
  padding = 'md',
  className = '',
  ...props
}) {
  const classes = [
    'rounded-lg border border-border bg-card text-card-foreground shadow-xs',
    hover
      ? 'cursor-pointer transition-[box-shadow,border-color,transform] duration-150 hover:-translate-y-px hover:border-input hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      : '',
    paddingClasses[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} tabIndex={hover ? 0 : undefined} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`mb-3 flex items-start justify-between gap-3 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3
      className={`font-display text-[15px] font-semibold leading-snug text-foreground ${className}`}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }) {
  return (
    <p className={`mt-0.5 text-[13px] leading-relaxed text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={`text-sm ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div
      className={`mt-4 flex items-center justify-end gap-2 border-t border-border pt-3 ${className}`}
    >
      {children}
    </div>
  );
}

export default Card;