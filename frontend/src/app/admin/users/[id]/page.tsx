"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";
import type { RiskReason, SellerApplication } from "@/lib/types";

type SellerScore = {
  score: number | null;
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
  seller_score: number | null;
  application_score: number | null;
  application_label: string;
  application_id: string | null;
  application_status: string | null;
  store_name: string;
  reasons: RiskReason[];
  documents_uploaded: number;
  missing_documents: string[];
  score_gap: number;
  score_synced: boolean;
  updated_at?: string;
};

type AdminUserDetail = {
  id: string;
  full_name: string;
  username: string;
  role: "customer" | "seller" | "admin";
  status: "active" | "monitored" | "restricted";
  phone?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
  trust: {
    trust_score: number;
    trust_label: string;
    approved_reviews: number;
    flagged_reviews: number;
    rejected_reviews: number;
  };
  seller?: {
    id: string;
    store_name: string;
    status: "active" | "suspended" | "restricted";
    trust_score: number;
  } | null;
  seller_score?: SellerScore | null;
};

type UserDetailResponse = {
  user: AdminUserDetail;
  applications: SellerApplication[];
  seller_products: {
    id: string;
    name: string;
    approval_status: string;
    product_risk_score: number;
    product_risk_label: string;
    product_risk_reasons?: RiskReason[];
    created_at?: string;
  }[];
  seller_reviews: {
    id: string;
    title: string;
    status: string;
    risk_score: number;
    risk_label: string;
    created_at?: string;
    products?: { name?: string };
  }[];
  moderation_logs: {
    id: string;
    target_type: string;
    action: string;
    notes?: string;
    created_at?: string;
    profiles?: { username?: string; full_name?: string };
  }[];
};

type TimelineEvent = {
  id: string;
  timestamp: string;
  label: string;
  detail?: string;
  tone: "good" | "warn" | "bad" | "neutral";
  direction?: "up" | "down" | "none";
  icon: "user" | "store" | "check" | "x" | "warn" | "log" | "bag" | "star";
};

function buildTimeline(data: UserDetailResponse): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (data.user.created_at) {
    events.push({
      id: "account-created",
      timestamp: data.user.created_at,
      label: "Account created",
      detail: `@${data.user.username} joined Sentra`,
      tone: "neutral",
      direction: "none",
      icon: "user",
    });
  }

  for (const app of data.applications) {
    if (app.submitted_at) {
      events.push({
        id: `app-submitted-${app.id}`,
        timestamp: app.submitted_at,
        label: "Seller application submitted",
        detail: `Applied for "${app.store_name}"`,
        tone: "neutral",
        direction: "none",
        icon: "store",
      });
    }
    if (app.status === "approved" && app.updated_at) {
      events.push({
        id: `app-approved-${app.id}`,
        timestamp: app.updated_at,
        label: "Application approved",
        detail: `"${app.store_name}" · Seller score ${app.risk_score ?? "—"}/100`,
        tone: "good",
        direction: "up",
        icon: "check",
      });
    } else if (app.status === "rejected" && app.updated_at) {
      events.push({
        id: `app-rejected-${app.id}`,
        timestamp: app.updated_at,
        label: "Application rejected",
        detail: `"${app.store_name}" · Score ${app.risk_score ?? "—"}/100`,
        tone: "bad",
        direction: "down",
        icon: "x",
      });
    } else if (app.status === "changes_requested" && app.updated_at) {
      events.push({
        id: `app-changes-${app.id}`,
        timestamp: app.updated_at,
        label: "Changes requested on application",
        detail: `"${app.store_name}"`,
        tone: "warn",
        direction: "none",
        icon: "warn",
      });
    }
  }

  for (const product of data.seller_products) {
    if (product.created_at) {
      events.push({
        id: `product-${product.id}`,
        timestamp: product.created_at,
        label: "Product listed",
        detail: `"${product.name}" · ${product.approval_status}`,
        tone: product.approval_status === "approved" ? "good" : product.approval_status === "rejected" ? "bad" : "neutral",
        direction: product.approval_status === "approved" ? "up" : product.approval_status === "rejected" ? "down" : "none",
        icon: "bag",
      });
    }
  }

  for (const review of data.seller_reviews) {
    if (review.created_at) {
      events.push({
        id: `review-${review.id}`,
        timestamp: review.created_at,
        label: "Review received on product",
        detail: `"${review.title || review.products?.name || "review"}" · risk ${review.risk_score}/100`,
        tone: review.risk_score >= 60 ? "bad" : review.risk_score >= 30 ? "warn" : "good",
        direction: review.risk_score >= 60 ? "down" : "none",
        icon: "star",
      });
    }
  }

  for (const log of data.moderation_logs) {
    if (log.created_at) {
      const isRestrict = log.action.includes("restrict") || log.action.includes("ban");
      const isRestore = log.action.includes("restore") || log.action.includes("unban") || log.action.includes("active");
      events.push({
        id: `log-${log.id}`,
        timestamp: log.created_at,
        label: log.action.replaceAll("_", " "),
        detail: log.notes || (log.profiles ? `by ${log.profiles.full_name || log.profiles.username}` : undefined),
        tone: isRestrict ? "bad" : isRestore ? "good" : "warn",
        direction: isRestrict ? "down" : isRestore ? "up" : "none",
        icon: "log",
      });
    }
  }

  return events.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function scoreBar(score?: number | null) {
  if (score == null) return "h-full bg-muted-foreground";
  if (score >= 80) return "h-full bg-success";
  if (score >= 60) return "h-full bg-warning";
  return "h-full bg-danger";
}

function riskTone(score: number): "good" | "warn" | "bad" {
  if (score >= 60) return "bad";
  if (score >= 30) return "warn";
  return "good";
}

const TIMELINE_ICONS: Record<TimelineEvent["icon"], React.ReactNode> = {
  user: <UserRound className="size-3.5" />,
  store: <Store className="size-3.5" />,
  check: <CheckCircle2 className="size-3.5" />,
  x: <XCircle className="size-3.5" />,
  warn: <ShieldAlert className="size-3.5" />,
  log: <Activity className="size-3.5" />,
  bag: <ShoppingBag className="size-3.5" />,
  star: <Star className="size-3.5" />,
};

const TONE_DOT: Record<TimelineEvent["tone"], string> = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-danger",
  neutral: "bg-muted-foreground",
};

const TONE_ICON_BG: Record<TimelineEvent["tone"], string> = {
  good: "bg-success/15 text-success",
  warn: "bg-warning/15 text-warning",
  bad: "bg-danger/15 text-danger",
  neutral: "bg-muted text-muted-foreground",
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError("");
    try {
      const next = await api.get<UserDetailResponse>(`/admin/users/${id}`, token);
      setData(next);
    } catch (err) {
      setError((err as Error).message || "Could not load user details.");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totalApplicationDeductions = useMemo(() => {
    const reasons = data?.user.seller_score?.reasons || [];
    return reasons.reduce((sum, reason) => sum + (reason.score_impact || 0), 0);
  }, [data?.user.seller_score?.reasons]);

  const timeline = useMemo(() => (data ? buildTimeline(data) : []), [data]);

  async function recalculate() {
    if (!token || !id) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.post(`/admin/users/${id}/seller-score/recalculate`, {}, token);
      await load();
      setNotice("Seller score recalculated and synced.");
    } catch (err) {
      setError((err as Error).message || "Could not recalculate seller score.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser() {
    if (!token || !id) return;
    const username = data?.user.username || "this user";
    if (
      !window.confirm(
        `Permanently delete @${username}?\n\nThis will remove their account, profile data, and all associated records. This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      await api.delete(`/admin/users/${id}`, token);
      router.push("/admin/users");
    } catch (err) {
      setError((err as Error).message || "Could not delete user.");
      setDeleting(false);
    }
  }

  const user = data?.user;
  const sellerScore = user?.seller_score;

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Back to users
            </Link>
            <p className="mt-5 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
              <UserRound className="size-3" />
              User intelligence
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              {user?.full_name || user?.username || "User details"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Account trust, seller score, application history, product & review risk, full account timeline, and moderation activity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sellerScore?.application_id ? (
              <Button disabled={busy || loading} onClick={recalculate}>
                <RefreshCw className="size-4" /> Recalculate
              </Button>
            ) : null}
            {user && user.role !== "admin" ? (
              <Button
                variant="danger"
                disabled={deleting || loading}
                onClick={removeUser}
              >
                <Trash2 className="size-4" /> Remove user
              </Button>
            ) : null}
          </div>
        </header>

        {notice ? <div className="mb-4 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">{notice}</div> : null}
        {error ? <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

        {loading ? (
          <div className="grid gap-4">
            <div className="h-44 rounded-xl bg-muted shimmer" />
            <div className="h-64 rounded-xl bg-muted shimmer" />
          </div>
        ) : !user ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">User not found.</div>
        ) : (
          <div className="grid gap-5">
            {/* Account info + seller score */}
            <section className="grid gap-4 xl:grid-cols-[1fr_1.25fr]">
              <div className="rounded-xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={user.role === "admin" ? "warn" : user.role === "seller" ? "good" : "neutral"}>{user.role}</Badge>
                  <Badge tone={user.status === "restricted" ? "bad" : user.status === "monitored" ? "warn" : "good"}>
                    {user.status === "restricted" ? "banned" : user.status}
                  </Badge>
                  {user.seller ? <Badge tone={user.seller.status === "active" ? "good" : "bad"}>seller {user.seller.status}</Badge> : null}
                </div>
                <h2 className="mt-4 text-xl font-semibold">{user.full_name || user.username}</h2>
                <p className="font-mono text-xs text-muted-foreground">@{user.username}</p>
                <div className="mt-5 grid gap-2.5 text-sm">
                  <div className="flex gap-2"><span className="w-24 shrink-0 text-muted-foreground">Phone</span><span>{user.phone || "—"}</span></div>
                  <div className="flex gap-2"><span className="w-24 shrink-0 text-muted-foreground">Address</span><span>{user.address || "—"}</span></div>
                  <div className="flex gap-2"><span className="w-24 shrink-0 text-muted-foreground">Joined</span><span>{fmtDate(user.created_at)}</span></div>
                  <div className="flex gap-2"><span className="w-24 shrink-0 text-muted-foreground">Updated</span><span>{fmtDate(user.updated_at)}</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/60 p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Seller score calculation</p>
                    <h2 className="mt-2 text-xl font-semibold">Higher score = stronger seller confidence</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Starts at 100. Each issue below deducts points.
                    </p>
                  </div>
                  <Store className="size-5 shrink-0 text-primary" />
                </div>

                {sellerScore ? (
                  <div className="mt-5">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-5xl font-semibold">{sellerScore.score ?? "—"}</span>
                        <span className="text-sm text-muted-foreground">/100</span>
                        <Badge tone={sellerScore.tone}>{sellerScore.label}</Badge>
                        {!sellerScore.score_synced ? <Badge tone="warn">not synced</Badge> : <Badge tone="good">synced</Badge>}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Application {sellerScore.application_score ?? "—"}</p>
                        <p>Seller row {sellerScore.seller_score ?? "—"}</p>
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                      <div className={scoreBar(sellerScore.score)} style={{ width: `${sellerScore.score ?? 0}%` }} />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-border bg-background/45 p-3">
                        <p className="text-xs text-muted-foreground">Total deductions</p>
                        <p className="mt-1 font-mono text-2xl font-semibold text-danger">-{totalApplicationDeductions}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background/45 p-3">
                        <p className="text-xs text-muted-foreground">Documents</p>
                        <p className="mt-1 font-mono text-2xl font-semibold">{sellerScore.documents_uploaded}/3</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background/45 p-3">
                        <p className="text-xs text-muted-foreground">Score gap</p>
                        <p className="mt-1 font-mono text-2xl font-semibold">{sellerScore.score_gap}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {sellerScore.reasons.length ? (
                        sellerScore.reasons.map((reason) => (
                          <div key={`${reason.rule_code}-${reason.reason}`} className="flex items-start justify-between gap-3 rounded-lg bg-muted/35 p-3 text-sm">
                            <div>
                              <Badge tone="neutral">{reason.category || "Score rule"}</Badge>
                              <p className="mt-2 font-medium">{reason.reason}</p>
                              {reason.rule_code ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{reason.rule_code}</p> : null}
                            </div>
                            <span className="shrink-0 font-mono text-danger">-{reason.score_impact || 0} pts</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg bg-success/10 p-3 text-sm text-success">
                          No deductions — profile, application, and required documents look complete.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                    This user has no seller application or seller record yet.
                  </p>
                )}
              </div>
            </section>

            {/* Trust + Applications */}
            <section className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-border bg-card/60 p-5">
                <ShieldCheck className="size-5 text-primary" />
                <h2 className="mt-3 font-semibold">Customer review trust</h2>
                <p className="mt-2 font-mono text-4xl font-semibold">{user.trust.trust_score}</p>
                <Badge tone={user.trust.trust_score <= 30 ? "bad" : user.trust.trust_score <= 70 ? "warn" : "good"}>
                  {user.trust.trust_label}
                </Badge>
                <div className="mt-4 grid gap-1 font-mono text-xs">
                  <span className="text-success">Approved {user.trust.approved_reviews}</span>
                  <span className="text-warning">Flagged {user.trust.flagged_reviews}</span>
                  <span className="text-danger">Rejected {user.trust.rejected_reviews}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/60 p-5 xl:col-span-2">
                <FileText className="size-5 text-primary" />
                <h2 className="mt-3 font-semibold">Seller applications</h2>
                <div className="mt-4 grid gap-2">
                  {(data.applications || []).map((application) => (
                    <Link
                      key={application.id}
                      href={`/admin/sellers/${application.id}`}
                      className="rounded-lg border border-border bg-background/45 p-3 hover:bg-muted/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{application.store_name}</p>
                          <p className="text-xs text-muted-foreground">{fmtDate(application.submitted_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={application.status === "approved" ? "good" : application.status === "rejected" ? "bad" : "warn"}>
                            {application.status.replaceAll("_", " ")}
                          </Badge>
                          <span className="font-mono text-sm">{application.risk_score}/100</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {!data.applications.length ? <p className="text-sm text-muted-foreground">No seller applications found.</p> : null}
                </div>
              </div>
            </section>

            {/* Product risk + Review risk */}
            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-border bg-card/60 p-5">
                <ShoppingBag className="size-5 text-primary" />
                <h2 className="mt-3 font-semibold">Seller product risk</h2>
                <div className="mt-4 grid gap-2">
                  {(data.seller_products || []).map((product) => (
                    <div key={product.id} className="rounded-lg bg-muted/35 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{product.name}</p>
                        <Badge tone={riskTone(product.product_risk_score || 0)}>{product.product_risk_label || "Genuine"}</Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{product.product_risk_score || 0} risk points · {product.approval_status}</p>
                    </div>
                  ))}
                  {!data.seller_products.length ? <p className="text-sm text-muted-foreground">No seller products found.</p> : null}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/60 p-5">
                <Star className="size-5 text-primary" />
                <h2 className="mt-3 font-semibold">Review risk on seller products</h2>
                <div className="mt-4 grid gap-2">
                  {(data.seller_reviews || []).map((review) => (
                    <div key={review.id} className="rounded-lg bg-muted/35 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{review.title || review.products?.name || "Customer review"}</p>
                        <Badge tone={riskTone(review.risk_score || 0)}>{review.risk_label}</Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{review.risk_score || 0}/100 · {review.status}</p>
                    </div>
                  ))}
                  {!data.seller_reviews.length ? <p className="text-sm text-muted-foreground">No seller product reviews found.</p> : null}
                </div>
              </div>
            </section>

            {/* Account timeline */}
            <section className="rounded-xl border border-border bg-card/60 p-5">
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-primary" />
                <h2 className="font-semibold">Account timeline</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Every recorded event for this account in reverse-chronological order.
              </p>
              <div className="mt-5">
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No timeline events to display.</p>
                ) : (
                  <ol className="relative border-l border-border">
                    {timeline.map((event) => (
                      <li key={event.id} className="mb-0 ml-5 pb-5 last:pb-0">
                        <span className={`absolute -left-2 flex size-4 items-center justify-center rounded-full ${TONE_ICON_BG[event.tone]}`}>
                          {TIMELINE_ICONS[event.icon]}
                        </span>
                        <div className="flex flex-wrap items-start justify-between gap-2 pl-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold capitalize">{event.label}</p>
                              {event.direction === "up" ? (
                                <TrendingUp className="size-3.5 text-success" />
                              ) : event.direction === "down" ? (
                                <TrendingDown className="size-3.5 text-danger" />
                              ) : null}
                              <span className={`size-1.5 rounded-full ${TONE_DOT[event.tone]}`} />
                            </div>
                            {event.detail ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
                            ) : null}
                          </div>
                          <time className="shrink-0 text-xs text-muted-foreground">{fmtDate(event.timestamp)}</time>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            {/* Moderation logs */}
            <section className="rounded-xl border border-border bg-card/60 p-5">
              <Activity className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold">Moderation log</h2>
              <div className="mt-4 grid gap-2">
                {(data.moderation_logs || []).map((log) => (
                  <div key={log.id} className="rounded-lg bg-muted/35 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{log.action.replaceAll("_", " ")}</p>
                      <span className="text-xs text-muted-foreground">{fmtDate(log.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{log.notes || "No notes provided."}</p>
                  </div>
                ))}
                {!data.moderation_logs.length ? <p className="text-sm text-muted-foreground">No moderation logs found.</p> : null}
              </div>
            </section>

            {/* Danger zone */}
            {user.role !== "admin" ? (
              <section className="rounded-xl border border-danger/30 bg-danger/5 p-5">
                <h2 className="font-semibold text-danger">Danger zone</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Permanently delete this account and all associated data. This action cannot be undone.
                </p>
                <Button
                  variant="danger"
                  className="mt-4"
                  disabled={deleting}
                  onClick={removeUser}
                >
                  <Trash2 className="size-4" />
                  {deleting ? "Deleting…" : `Delete @${user.username}`}
                </Button>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
