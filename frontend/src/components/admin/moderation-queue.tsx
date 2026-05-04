"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Fingerprint, ShieldAlert, ShieldX, Sparkles, Wifi } from "lucide-react";

import type { Review } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Filter = "all" | "high_risk" | "suspicious" | "borderline";

export function ModerationQueue() {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      api
        .get<{ reviews: Review[] }>("/admin/reviews/flagged?include_borderline=true", token)
        .then((d) => {
          if (alive) setReviews(d.reviews || []);
        })
        .catch(() => {
          if (alive) setReviews([]);
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

  const counts = useMemo(() => {
    const moderationOnly = reviews.filter((r) => r.status === "flagged" || r.status === "quarantined");
    const high = moderationOnly.filter((r) => r.risk_score >= 55).length;
    const susp = moderationOnly.filter((r) => r.risk_score < 55 && r.risk_score >= 25).length;
    const border = reviews.filter((r) => r.status === "published").length;
    return { all: moderationOnly.length, high_risk: high, suspicious: susp, borderline: border };
  }, [reviews]);

  const filtered = useMemo(() => {
    if (filter === "borderline") return reviews.filter((r) => r.status === "published");
    const moderationOnly = reviews.filter((r) => r.status === "flagged" || r.status === "quarantined");
    if (filter === "all") return moderationOnly;
    if (filter === "high_risk") return moderationOnly.filter((r) => r.risk_score >= 55);
    return moderationOnly.filter((r) => r.risk_score < 55 && r.risk_score >= 25);
  }, [reviews, filter]);

  async function moderate(reviewId: string, action: "approve" | "reject" | "quarantine") {
    if (!token) return;
    setBusy(`${reviewId}:${action}`);
    try {
      await api.post(`/admin/reviews/${reviewId}/${action}`, { notes: `Admin ${action}` }, token);
      setReviews((cur) => cur.filter((r) => r.id !== reviewId));
      setToast({ kind: "ok", msg: `Review ${action}d.` });
    } catch (e) {
      setToast({ kind: "err", msg: (e as Error).message || "Action failed." });
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 2200);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl bg-muted shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "all", label: "All flagged", count: counts.all, tone: "neutral" as const },
            { id: "high_risk", label: "High risk", count: counts.high_risk, tone: "bad" as const },
            { id: "suspicious", label: "Suspicious", count: counts.suspicious, tone: "warn" as const },
            { id: "borderline", label: "Borderline (auto-published)", count: counts.borderline, tone: "neutral" as const },
          ] satisfies { id: Filter; label: string; count: number; tone: "neutral" | "bad" | "warn" }[]
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.id
                ? "border-primary/40 bg-primary/14 text-primary"
                : "border-border bg-card/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {f.label}
            <span className="font-mono">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-md border p-3 text-xs ${
            toast.kind === "ok"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="grid min-h-60 place-items-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
          <div>
            <CheckCircle2 className="mx-auto size-8 text-success" />
            <p className="mt-3 text-sm font-semibold">Queue empty</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No reviews matching this filter. Sentra is monitoring continuously.
            </p>
          </div>
        </div>
      ) : (
        filtered.map((review) => (
          <article
            key={review.id}
            className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={review.risk_score >= 60 ? "bad" : "warn"}>{review.risk_label}</Badge>
                <span className="font-mono text-sm font-semibold">{review.risk_score}/100</span>
                {review.products?.name && (
                  <span className="text-xs text-muted-foreground">on {review.products.name}</span>
                )}
                <span className="text-xs text-muted-foreground/60">·</span>
                <span className="font-mono text-xs text-muted-foreground">@{review.profiles?.username || "—"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => moderate(review.id, "approve")}
                  disabled={busy === `${review.id}:approve`}
                >
                  <CheckCircle2 className="size-4" />
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => moderate(review.id, "quarantine")}
                  disabled={busy === `${review.id}:quarantine`}
                >
                  <ShieldAlert className="size-4" />
                  Quarantine
                </Button>
                <Button
                  variant="danger"
                  onClick={() => moderate(review.id, "reject")}
                  disabled={busy === `${review.id}:reject`}
                >
                  <ShieldX className="size-4" />
                  Reject
                </Button>
              </div>
            </div>

            {review.signals ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${
                    typeof review.signals.account_age_days === "number" && review.signals.account_age_days < 7
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-border bg-card/50 text-muted-foreground"
                  }`}
                >
                  Account: {typeof review.signals.account_age_days === "number" ? `${review.signals.account_age_days}d` : "?"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${
                    review.signals.verified_purchase
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-warning/40 bg-warning/10 text-warning"
                  }`}
                >
                  {review.signals.verified_purchase ? "Verified purchase" : "No purchase"}
                </span>
                {review.signals.device_cluster_size > 1 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 font-medium text-danger">
                    <Fingerprint className="size-3" /> {review.signals.device_cluster_size} accts on device {review.signals.device_fingerprint_short || "?"}
                  </span>
                ) : review.signals.device_fingerprint_short ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/50 px-2 py-0.5 font-mono text-muted-foreground">
                    <Fingerprint className="size-3" /> {review.signals.device_fingerprint_short}
                  </span>
                ) : null}
                {review.signals.ip_cluster_size > 1 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 font-medium text-danger">
                    <Wifi className="size-3" /> {review.signals.ip_cluster_size} accts on IP {review.signals.ip_hash_short || "?"}
                  </span>
                ) : null}
                {review.status === "published" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 font-medium text-warning">
                    Borderline · auto-published
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex items-start gap-3 rounded-lg bg-muted/30 p-3">
              <span className="mt-1 inline-flex shrink-0 text-muted-foreground">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < review.rating ? "text-warning" : "text-muted-foreground/30"}>
                    ★
                  </span>
                ))}
              </span>
              <div className="min-w-0 flex-1">
                {review.title && <h3 className="font-semibold leading-snug">{review.title}</h3>}
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{review.body}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Sparkles className="size-3 text-primary" />
                Triggered Sentra rules ({review.review_flags?.length || 0})
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {(review.review_flags || []).map((flag, i) => (
                  <div key={`${review.id}-${i}`} className="rounded-md border border-border/60 bg-background/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Badge tone={flag.score_impact >= 10 ? "bad" : flag.score_impact >= 7 ? "warn" : "neutral"}>
                          {flag.category}
                        </Badge>
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground">{flag.rule_code}</p>
                        <p className="mt-1 text-sm">{flag.reason}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold text-primary">+{flag.score_impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
