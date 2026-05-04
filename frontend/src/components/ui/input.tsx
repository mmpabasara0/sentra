import { cn } from "@/lib/utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm outline-none ring-primary/25 placeholder:text-muted-foreground focus:border-primary focus:ring-4",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full rounded-md border border-border bg-card px-3 py-3 text-sm leading-6 outline-none ring-primary/25 placeholder:text-muted-foreground focus:border-primary focus:ring-4",
        props.className,
      )}
    />
  );
}
