import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-leaf-700 text-white hover:bg-leaf-600 focus-visible:ring-leaf-700",
  secondary: "bg-cream-100 text-ink-900 hover:bg-cream-200 focus-visible:ring-leaf-700",
  outline:
    "border border-leaf-700 text-leaf-700 hover:bg-leaf-50 focus-visible:ring-leaf-700",
  ghost: "text-leaf-700 hover:bg-leaf-50 focus-visible:ring-leaf-700",
  danger: "bg-red-700 text-white hover:bg-red-600 focus-visible:ring-red-700",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

/** Primary action button. `loading` disables the button and shows a spinner state. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-700",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}
