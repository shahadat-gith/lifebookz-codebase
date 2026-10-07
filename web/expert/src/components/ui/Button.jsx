import { Icons } from '../../icons';

const variantClasses = {
  primary:
    'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary',
  secondary:
    'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/90',
  accent:
    'bg-accent text-accent-foreground shadow-xs hover:bg-accent/90',
  outline:
    'border border-input bg-card text-foreground hover:bg-muted hover:border-border',
  ghost:
    'bg-transparent text-foreground hover:bg-muted',
  danger:
    'bg-destructive text-white shadow-xs hover:bg-destructive/90',
  success:
    'bg-success text-white shadow-xs hover:bg-success/90',
};

const sizeClasses = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-sm',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-1.5 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-lg',
};

const iconOnlySizes = {
  xs: 'size-7 rounded-sm',
  sm: 'size-8 rounded-md',
  md: 'size-9 rounded-md',
  lg: 'size-11 rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconOnly = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  const isDisabled = disabled || loading;

  const classes = [
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none',
    'font-medium tracking-normal',
    'transition-[background-color,border-color,box-shadow,transform] duration-150',
    'active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    iconOnly ? iconOnlySizes[size] : sizeClasses[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Icons.spinner className="size-4 animate-spin" />
      ) : icon ? (
        <span className="flex shrink-0 items-center [&>svg]:size-4">{icon}</span>
      ) : null}
      {!iconOnly && children}
    </button>
  );
}

export default Button;