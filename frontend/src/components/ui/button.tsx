import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold outline-none ring-primary/30 focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-px",
        variant === "primary" && "bg-primary text-primary-foreground shadow-[0_14px_35px_-22px_var(--primary)] hover:bg-primary/92",
        variant === "secondary" && "border border-border bg-card/86 text-foreground hover:bg-muted",
        variant === "ghost" && "text-foreground hover:bg-muted",
        variant === "danger" && "bg-danger text-white hover:bg-danger/90",
        variant === "outline" && "border border-border bg-transparent text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
