import { ShieldCheck } from "lucide-react";

import { RiskReport } from "@/components/admin/risk-report";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminReviewDetailPage() {
  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <ShieldCheck className="size-3" />
            Explainable fraud scoring
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Review risk report</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Each rule produces a reason and score impact so the admin can explain every moderation decision.
          </p>
        </header>
        <RiskReport />
      </div>
    </AppShell>
  );
}
