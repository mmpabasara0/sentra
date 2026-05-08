import { ShieldAlert } from "lucide-react";

import { ModerationQueue } from "@/components/admin/moderation-queue";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminReviewsPage() {
  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <ShieldAlert className="size-3" />
            Sentra engine output
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Review moderation</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Approve genuine reviews, reject fakes, or quarantine high-risk submissions. Each entry shows the exact rules that triggered the flag.
          </p>
        </header>
        <ModerationQueue />
      </div>
    </AppShell>
  );
}
