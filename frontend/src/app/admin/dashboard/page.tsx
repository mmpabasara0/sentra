import { ShieldCheck } from "lucide-react";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminDashboardPage() {
  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <ShieldCheck className="size-3" />
            Review integrity command center
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Sentra overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Monitor fake reviews, suspicious users, rating anomalies, and moderation actions across NovaMart from a single command screen.
          </p>
        </header>
        <AdminDashboard />
      </div>
    </AppShell>
  );
}
