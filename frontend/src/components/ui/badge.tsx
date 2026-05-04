import { cn } from "@/lib/utils";

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-3 text-xs font-semibold",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "good" && "bg-success/12 text-success",
        tone === "warn" && "bg-warning/14 text-warning",
        tone === "bad" && "bg-danger/12 text-danger",
        className
      )}
    >
      {children}
    </span>
  );
}
