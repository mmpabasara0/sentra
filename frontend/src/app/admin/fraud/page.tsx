"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Fingerprint, ShieldAlert, TrendingUp, Wifi } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";

type ClusterMember = { user_id: string; username: string; full_name: string };

type DeviceCluster = {
  device_fingerprint: string;
  device_fingerprint_short: string;
  user_count: number;
  members: ClusterMember[];
};

type RecentAlert = {
  id: string;
  alert_type: string;
  severity: string;
  description: string;
  status: string;
  created_at: string;
  metadata?: { trigger_review_ids?: string[]; device_fingerprint?: string } | null;
  products?: { name?: string };
};

type ExtremeReview = {
  id: string;
  rating: number;
  body: string;
  status: string;
  risk_score: number;
  risk_label: string;
  created_at: string;
  products?: { name?: string };
  profiles?: { username?: string; full_name?: string; created_at?: string };
};

type FraudResponse = {
  metrics: {
    new_account_extreme_reviews_24h: number;
    multi_account_devices_7d: number;
    multi_account_ips_7d: number;
  };
  device_clusters: DeviceCluster[];
  recent_alerts: RecentAlert[];
  new_account_extreme_reviews: ExtremeReview[];
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

function accountAge(createdAt?: string) {
  if (!createdAt) return null;
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  return days < 0 ? 0 : days;
}

export default function FraudOverviewPage() {
  const { token } = useAuth();
  const [data, setData] = useState<FraudResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      api
        .get<FraudResponse>("/admin/fraud/overview", token)
        .then((res) => {
          if (alive) setData(res);
        })
        .catch((e) => {
          if (alive) setErr((e as Error).message || "Failed to load fraud overview.");
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

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <Fingerprint className="size-3" />
            Sentra fraud signals
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Fraud overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Live look at multi-account device clusters, IP clusters, new-account extreme ratings, and the latest anomaly alerts raised by the Sentra engine.
          </p>
        </header>

        {err ? (
          <div className="rounded-xl border border-danger/40 bg-danger/8 p-5 text-sm text-danger">{err}</div>
        ) : null}

        {loading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted shimmer" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="mb-6 grid gap-3 md:grid-cols-3">
              <KpiTile
                icon={AlertTriangle}
                label="New-account extreme ratings (24h)"
                value={data.metrics.new_account_extreme_reviews_24h}
                tone={data.metrics.new_account_extreme_reviews_24h > 0 ? "bad" : "neutral"}
              />
              <KpiTile
                icon={Fingerprint}
                label="Multi-account devices (7d)"
                value={data.metrics.multi_account_devices_7d}
                tone={data.metrics.multi_account_devices_7d > 0 ? "bad" : "neutral"}
              />
              <KpiTile
                icon={Wifi}
                label="Multi-account IPs (7d)"
                value={data.metrics.multi_account_ips_7d}
                tone={data.metrics.multi_account_ips_7d > 0 ? "warn" : "neutral"}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-border bg-card/55 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <Fingerprint className="size-4 text-primary" /> Device clusters
                  </h2>
                  <span className="text-xs text-muted-foreground">{data.device_clusters.length} active</span>
                </div>
                {data.device_clusters.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    No devices have posted reviews from more than one account in the last 7 days.
                  </p>
                ) : (
                  <ul className="mt-4 grid gap-3">
                    {data.device_clusters.map((cluster) => (
                      <li key={cluster.device_fingerprint} className="rounded-lg border border-danger/30 bg-danger/5 p-3">
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
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card/55 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <TrendingUp className="size-4 text-primary" /> New-account extreme ratings (24h)
                  </h2>
                  <span className="text-xs text-muted-foreground">{data.new_account_extreme_reviews.length} reviews</span>
                </div>
                {data.new_account_extreme_reviews.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    No fresh accounts left a 1-star or 5-star review in the last 24 hours.
                  </p>
                ) : (
                  <ul className="mt-4 grid gap-2">
                    {data.new_account_extreme_reviews.map((review) => {
                      const age = accountAge(review.profiles?.created_at);
                      return (
                        <li key={review.id} className="rounded-md border border-border/70 bg-background/40 p-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono">{review.rating}★</span>
                            <Badge tone={review.risk_score >= 55 ? "bad" : review.risk_score >= 25 ? "warn" : "good"}>
                              {review.risk_label}
                            </Badge>
                            <span className="font-mono text-muted-foreground">{review.risk_score}</span>
                            <span className="text-muted-foreground">on</span>
                            <span className="truncate font-medium">{review.products?.name || review.id.slice(0, 6)}</span>
                            <span className="text-muted-foreground/70">·</span>
                            <span className="text-muted-foreground">{fmtTimeAgo(review.created_at)}</span>
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{review.body}</p>
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>
                              by <span className="font-mono">@{review.profiles?.username || "?"}</span>
                              {age !== null ? ` · account ${age}d old` : null}
                            </span>
                            <Link href={`/admin/reviews/${review.id}`} className="text-primary hover:underline">
                              Open report
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <section className="mt-6 rounded-xl border border-border bg-card/55 p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  <ShieldAlert className="size-4 text-primary" /> Latest anomaly alerts
                </h2>
                <Link href="/admin/anomalies" className="text-xs text-primary hover:underline">
                  All anomalies
                </Link>
              </div>
              {data.recent_alerts.length === 0 ? (
                <p className="mt-4 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  No anomaly alerts have been raised yet.
                </p>
              ) : (
                <ul className="mt-4 grid gap-2">
                  {data.recent_alerts.map((alert) => (
                    <li key={alert.id} className="rounded-md border border-border/70 bg-background/40 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone={alert.severity === "high" ? "bad" : alert.severity === "medium" ? "warn" : "neutral"}>
                          {alert.severity}
                        </Badge>
                        <span className="font-mono text-muted-foreground">{alert.alert_type}</span>
                        {alert.products?.name ? (
                          <span className="text-muted-foreground">on {alert.products.name}</span>
                        ) : null}
                        <span className="ml-auto text-muted-foreground/70">{fmtTimeAgo(alert.created_at)}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{alert.description}</p>
                      {alert.metadata?.trigger_review_ids && alert.metadata.trigger_review_ids.length > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="text-muted-foreground">Reviews:</span>
                          {alert.metadata.trigger_review_ids.slice(0, 6).map((rid) => (
                            <Link
                              key={rid}
                              href={`/admin/reviews/${rid}`}
                              className="rounded-full border border-border bg-card/70 px-2 py-0.5 font-mono hover:border-primary hover:text-primary"
                            >
                              {rid.slice(0, 6)}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "neutral" | "warn" | "bad";
}) {
  const ring =
    tone === "bad"
      ? "bg-danger/14 text-danger"
      : tone === "warn"
        ? "bg-warning/14 text-warning"
        : "bg-primary/12 text-primary";
  return (
    <article className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
      <span className={`grid size-9 place-items-center rounded-lg ${ring}`}>
        <Icon className="size-4" />
      </span>
      <p className="mt-4 font-mono text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
    </article>
  );
}
