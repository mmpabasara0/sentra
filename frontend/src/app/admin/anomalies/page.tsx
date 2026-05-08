"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Fingerprint, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";

type AlertMetadata = {
  trigger_review_ids?: string[];
  profile_ids?: string[];
  product_ids?: string[];
  device_fingerprint?: string;
  unverified_count?: number;
  total_count?: number;
};

type Alert = {
  id: string;
  alert_type: string;
  severity: "low" | "medium" | "high" | string;
  description: string;
  status: string;
  created_at: string;
  metadata?: AlertMetadata | null;
  products?: { name?: string };
};

type DeviceCluster = {
  device_fingerprint: string;
  device_fingerprint_short: string;
  user_count: number;
  members: { user_id: string; username: string; full_name: string }[];
};

type FraudOverview = {
  metrics: {
    new_account_extreme_reviews_24h: number;
    multi_account_devices_7d: number;
    multi_account_ips_7d: number;
  };
  device_clusters: DeviceCluster[];
};

const SEVERITY_TONE: Record<string, "bad" | "warn" | "neutral"> = {
  high: "bad",
  medium: "warn",
  low: "neutral",
};

function fmtTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function AnomaliesPage() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [overview, setOverview] = useState<FraudOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      Promise.all([
        api.get<{ alerts: Alert[] }>("/admin/products/anomalies", token).catch(() => ({ alerts: [] })),
        api.get<FraudOverview>("/admin/fraud/overview", token).catch(() => null),
      ])
        .then(([alertsData, overviewData]) => {
          if (!alive) return;
          setAlerts(alertsData.alerts || []);
          setOverview(overviewData);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [token]);

  const open = alerts.filter((a) => a.status === "open");
  const resolved = alerts.filter((a) => a.status !== "open");

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <TrendingUp className="size-3" />
            Manipulation monitoring
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Rating anomaly alerts</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Product-level alerts for review bursts, new-account clusters, and other coordinated rating manipulation patterns detected by Sentra.
          </p>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card/55 p-4">
            <p className="text-xs text-muted-foreground">Open alerts</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-danger">{open.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/55 p-4">
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-success">{resolved.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/55 p-4">
            <p className="text-xs text-muted-foreground">Total tracked</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{alerts.length}</p>
          </div>
        </div>

        {overview && overview.device_clusters.length > 0 ? (
          <section className="mb-6 rounded-xl border border-border bg-card/55 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                  <Fingerprint className="size-3" />
                  Active multi-account devices
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">Devices reviewing under more than one account</h2>
              </div>
              <Link href="/admin/fraud" className="text-xs text-primary hover:underline">
                Open fraud overview
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {overview.device_clusters.map((cluster) => (
                <div key={cluster.device_fingerprint} className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-muted-foreground">device {cluster.device_fingerprint_short}</p>
                    <Badge tone="bad">{cluster.user_count} accts</Badge>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {cluster.members.map((member) => (
                      <li key={member.user_id}>
                        <Link
                          href={`/admin/users/${member.user_id}`}
                          className="inline-flex items-center rounded-full border border-border bg-card/70 px-2 py-0.5 font-mono text-[11px] text-foreground hover:border-primary hover:text-primary"
                        >
                          @{member.username || member.user_id.slice(0, 6)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted shimmer" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="grid min-h-60 place-items-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
            <div>
              <CheckCircle2 className="mx-auto size-8 text-success" />
              <p className="mt-3 text-sm font-semibold">No anomalies detected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The Sentra rating-anomaly scanner has not raised any alerts.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {alerts.map((a) => (
              <article
                key={a.id}
                className="rounded-xl border border-border bg-card/55 p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                        a.severity === "high"
                          ? "bg-danger/14 text-danger"
                          : a.severity === "medium"
                            ? "bg-warning/14 text-warning"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <AlertTriangle className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={SEVERITY_TONE[a.severity] || "neutral"}>{a.severity} severity</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{a.alert_type}</span>
                        {a.status === "open" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-danger">
                            <span className="size-1.5 animate-pulse rounded-full bg-danger" />
                            Open
                          </span>
                        ) : (
                          <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-success">
                            Resolved
                          </span>
                        )}
                      </div>
                      {a.products?.name && (
                        <h2 className="mt-2 text-lg font-semibold tracking-tight">{a.products.name}</h2>
                      )}
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{a.description}</p>
                      {a.metadata && (a.metadata.trigger_review_ids || []).length > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Triggering reviews
                          </span>
                          {(a.metadata.trigger_review_ids || []).slice(0, 8).map((rid) => (
                            <Link
                              key={rid}
                              href={`/admin/reviews/${rid}`}
                              className="inline-flex items-center rounded-full border border-border bg-background/40 px-2 py-0.5 font-mono text-[10px] hover:border-primary hover:text-primary"
                            >
                              {rid.slice(0, 6)}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                      {a.metadata?.device_fingerprint ? (
                        <p className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                          <Fingerprint className="size-3" /> device {a.metadata.device_fingerprint.slice(0, 8)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground/70">{fmtTimeAgo(a.created_at)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
