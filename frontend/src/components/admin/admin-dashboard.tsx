"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  FlaskConical,
  Gauge,
  PackageSearch,
  ShieldAlert,
  ShieldCheck,
  Store,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ─── types ───────────────────────────────────────────── */
type Cards = {
  total_users: number;
  total_products: number;
  total_reviews: number;
  flagged_reviews: number;
  high_risk_users: number;
  rating_alerts: number;
  seller_applications?: number;
  pending_products?: number;
  new_account_extreme_reviews_24h?: number;
  multi_account_devices_7d?: number;
};

type DeviceClusterMember = { user_id: string; username: string; full_name: string };
type DeviceCluster = {
  device_fingerprint: string;
  device_fingerprint_short: string;
  user_count: number;
  members: DeviceClusterMember[];
};
type FraudOverview = {
  metrics: {
    new_account_extreme_reviews_24h: number;
    multi_account_devices_7d: number;
    multi_account_ips_7d: number;
  };
  device_clusters: DeviceCluster[];
};

type Overview = {
  reviews_by_day: { date: string; genuine: number; suspicious: number; high_risk: number }[];
  risk_distribution: { label: string; count: number }[];
  trust_distribution: { label: string; count: number }[];
  top_risky_users: {
    trust_score: number;
    trust_label: string;
    profiles?: { username?: string; full_name?: string };
  }[];
  latest_actions: {
    id: string;
    action: string;
    target_type: string;
    target_id: string;
    notes?: string;
    created_at: string;
    profiles?: { username?: string; full_name?: string };
  }[];
};

/* ─── helpers ─────────────────────────────────────────── */
const RISK_COLORS: Record<string, string> = {
  Genuine: "var(--success, #22c55e)",
  Suspicious: "var(--warning, #f59e0b)",
  "High Risk": "var(--danger, #ef4444)",
  Pending: "#94a3b8",
  Unknown: "#64748b",
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

function fmtDateLabel(iso: string) {
  return new Intl.DateTimeFormat("en-LK", { month: "short", day: "numeric" }).format(new Date(iso));
}

/* ─── tiny components ─────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  tone?: "neutral" | "warn" | "bad" | "good";
  href?: string;
}) {
  const ringTone = {
    neutral: "bg-primary/12 text-primary",
    warn: "bg-warning/14 text-warning",
    bad: "bg-danger/14 text-danger",
    good: "bg-success/14 text-success",
  }[tone];
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span className={`grid size-9 place-items-center rounded-lg ${ringTone}`}>
          <Icon className="size-4" />
        </span>
        {href && <ArrowRight className="size-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />}
      </div>
      <p className="mt-4 font-mono text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground/60">{sub}</p>}
    </>
  );
  const className = "rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)] transition-colors group";
  if (href) {
    return (
      <Link href={href} className={`${className} hover:bg-card/90`}>
        {inner}
      </Link>
    );
  }
  return <article className={className}>{inner}</article>;
}

function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 font-semibold tracking-tight">
          {Icon && <Icon className="size-4 text-primary" />}
          {title}
        </h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ─── main ────────────────────────────────────────────── */
export function AdminDashboard() {
  const { token } = useAuth();
  const [cards, setCards] = useState<Cards | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [flagged, setFlagged] = useState<
    {
      id: string;
      title: string;
      body: string;
      risk_score: number;
      risk_label: string;
      status: string;
      profiles?: { username?: string };
      products?: { name?: string };
    }[]
  >([]);
  const [fraud, setFraud] = useState<FraudOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setErr(null);
      Promise.all([
        api.get<{ cards: Cards }>("/admin/dashboard", token),
        api.get<Overview>("/admin/analytics/overview", token),
        api.get<{ reviews: typeof flagged }>("/admin/reviews/flagged", token),
        api.get<FraudOverview>("/admin/fraud/overview", token).catch(() => null),
      ])
        .then(([d, o, r, f]) => {
          if (!alive) return;
          setCards(d.cards);
          setOverview(o);
          setFlagged(r.reviews || []);
          setFraud(f);
        })
        .catch((e) => {
          if (alive) setErr((e as Error).message || "Failed to load admin data.");
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

  const kpis = useMemo(() => {
    const c = cards ?? {
      total_users: 0,
      total_products: 0,
      total_reviews: 0,
      flagged_reviews: 0,
      high_risk_users: 0,
      rating_alerts: 0,
      seller_applications: 0,
      pending_products: 0,
    };
    return [
      { label: "Total users", value: c.total_users, icon: UsersRound, tone: "neutral" as const },
      { label: "Total reviews", value: c.total_reviews, icon: Gauge, tone: "neutral" as const },
      { label: "Flagged reviews", value: c.flagged_reviews, icon: ShieldAlert, tone: "warn" as const, href: "/admin/reviews" },
      { label: "High-risk users", value: c.high_risk_users, icon: AlertTriangle, tone: "bad" as const, href: "/admin/users" },
      { label: "Rating alerts", value: c.rating_alerts, icon: TrendingUp, tone: "warn" as const, href: "/admin/anomalies" },
      {
        label: "New-account 5★/1★ (24h)",
        value: c.new_account_extreme_reviews_24h ?? 0,
        icon: AlertTriangle,
        tone: ((c.new_account_extreme_reviews_24h ?? 0) > 0 ? "bad" : "neutral") as "bad" | "neutral",
        href: "/admin/fraud",
      },
      {
        label: "Multi-account devices (7d)",
        value: c.multi_account_devices_7d ?? 0,
        icon: Fingerprint,
        tone: ((c.multi_account_devices_7d ?? 0) > 0 ? "bad" : "neutral") as "bad" | "neutral",
        href: "/admin/fraud",
      },
      { label: "Seller applications", value: c.seller_applications ?? 0, icon: Store, tone: "neutral" as const, href: "/admin/sellers" },
      { label: "Pending products", value: c.pending_products ?? 0, icon: PackageSearch, tone: "neutral" as const, href: "/admin/products" },
      { label: "Total products", value: c.total_products, icon: CheckCircle2, tone: "good" as const },
    ];
  }, [cards]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted shimmer" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-muted shimmer" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/8 p-5 text-sm">
        <p className="font-semibold text-danger">Could not load admin data</p>
        <p className="mt-1 text-muted-foreground">{err}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Make sure the Flask backend is running and your account has the admin role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Big charts row */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Reviews trend */}
        <article className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
          <SectionHeader
            title="Review intake — last 14 days"
            description="Daily volume by Sentra risk classification"
            icon={Activity}
          />
          <div className="h-64">
            {overview && overview.reviews_by_day.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.reviews_by_day} margin={{ left: -16, right: 0, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDateLabel}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(l) => fmtDateLabel(String(l))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="genuine" stackId="a" fill={RISK_COLORS.Genuine} name="Genuine" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="suspicious" stackId="a" fill={RISK_COLORS.Suspicious} name="Suspicious" />
                  <Bar dataKey="high_risk" stackId="a" fill={RISK_COLORS["High Risk"]} name="High risk" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No review activity in the last 14 days.
              </div>
            )}
          </div>
        </article>

        {/* Risk distribution donut */}
        <article className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
          <SectionHeader
            title="Risk distribution"
            description="All reviews by risk label"
            icon={ShieldCheck}
          />
          <div className="h-64">
            {overview && overview.risk_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overview.risk_distribution}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {overview.risk_distribution.map((entry) => (
                      <Cell key={entry.label} fill={RISK_COLORS[entry.label] || "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                No reviews scored yet.
              </div>
            )}
          </div>
        </article>
      </div>

      {/* Multi-account devices */}
      {fraud && fraud.device_clusters.length > 0 ? (
        <article className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
          <SectionHeader
            title="Multi-account devices"
            description="One device fingerprint posting reviews from more than one account in the last 7 days"
            icon={Fingerprint}
            action={
              <Link href="/admin/fraud" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Open fraud overview <ArrowRight className="size-3" />
              </Link>
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            {fraud.device_clusters.slice(0, 4).map((cluster) => (
              <div key={cluster.device_fingerprint} className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs text-muted-foreground">device {cluster.device_fingerprint_short}</p>
                  <Badge tone="bad">{cluster.user_count} accts</Badge>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {cluster.members.slice(0, 8).map((member) => (
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
        </article>
      ) : null}

      {/* Mid row: top risky users + latest actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
          <SectionHeader
            title="Lowest-trust reviewers"
            description="Users most likely to post fake reviews"
            icon={UsersRound}
            action={
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            }
          />
          {overview && overview.top_risky_users.length > 0 ? (
            <ul className="divide-y divide-border">
              {overview.top_risky_users.map((u, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted font-mono text-xs font-semibold">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {u.profiles?.full_name || u.profiles?.username || "Unknown user"}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      @{u.profiles?.username || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold">{u.trust_score}</p>
                    <Badge tone={u.trust_score <= 30 ? "bad" : u.trust_score <= 70 ? "warn" : "good"}>
                      {u.trust_label}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="grid h-32 place-items-center text-sm text-muted-foreground">No risky users detected.</p>
          )}
        </article>

        <article className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
          <SectionHeader
            title="Recent moderation actions"
            description="Latest admin decisions across the platform"
            icon={Activity}
            action={
              <Link
                href="/admin/moderation-logs"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Audit log <ArrowRight className="size-3" />
              </Link>
            }
          />
          {overview && overview.latest_actions.length > 0 ? (
            <ul className="divide-y divide-border">
              {overview.latest_actions.map((log) => (
                <li key={log.id} className="flex items-start gap-3 py-3">
                  <span
                    className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${
                      log.action === "approve"
                        ? "bg-success/14 text-success"
                        : log.action === "reject"
                          ? "bg-danger/14 text-danger"
                          : "bg-warning/14 text-warning"
                    }`}
                  >
                    {log.action === "approve" ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : log.action === "reject" ? (
                      <ShieldAlert className="size-3.5" />
                    ) : (
                      <AlertTriangle className="size-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold capitalize">{log.action.replace("_", " ")}</span>{" "}
                      <span className="text-muted-foreground">on {log.target_type}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      by {log.profiles?.username || log.profiles?.full_name || "system"} · {fmtTimeAgo(log.created_at)}
                    </p>
                    {log.notes && <p className="mt-1 truncate text-xs italic text-muted-foreground/80">&quot;{log.notes}&quot;</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="grid h-32 place-items-center text-sm text-muted-foreground">No moderation activity yet.</p>
          )}
        </article>
      </div>

      {/* Live moderation queue */}
      <article className="rounded-xl border border-border bg-card/70 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold tracking-tight">
              <ShieldAlert className="size-4 text-primary" />
              Live moderation queue
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Reviews flagged or quarantined by the Sentra engine, sorted by risk.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/tester">
              <Button variant="outline">
                <FlaskConical className="size-4" />
                Test the engine
              </Button>
            </Link>
            <Link href="/admin/reviews">
              <Button variant="secondary">
                Open queue
                <ChevronRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>

        {flagged.length === 0 ? (
          <div className="grid place-items-center p-10 text-center">
            <CheckCircle2 className="size-8 text-success/70" />
            <p className="mt-3 text-sm font-semibold">All clear</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No flagged reviews waiting for review. The Sentra engine will surface anything suspicious here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {flagged.slice(0, 6).map((r) => (
              <li key={r.id} className="grid gap-3 p-5 md:grid-cols-[1fr_180px_120px] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.risk_score >= 60 ? "bad" : "warn"}>{r.risk_label}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{r.risk_score}/100</span>
                    {r.products?.name && (
                      <span className="text-xs text-muted-foreground">· {r.products.name}</span>
                    )}
                  </div>
                  {r.title && <h3 className="mt-2 font-semibold leading-snug">{r.title}</h3>}
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground line-clamp-2">{r.body}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Reviewer
                  <p className="mt-0.5 font-mono text-foreground">@{r.profiles?.username || "—"}</p>
                </div>
                <Link href={`/admin/reviews/${r.id}`}>
                  <Button variant="secondary">Risk report</Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}
