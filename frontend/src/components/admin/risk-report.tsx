"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fingerprint, Wifi } from "lucide-react";

import { demoFlaggedReviews } from "@/lib/demo-data";
import type { Review } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/badge";

type CoUser = {
  user_id: string;
  username: string;
  full_name: string;
  shared: string[];
};

type SubmissionContext = {
  device_fingerprint: string;
  device_fingerprint_short: string;
  ip_hash: string;
  ip_hash_short: string;
  user_agent: string;
  account_age_days: number | null;
  verified_purchase: boolean;
  device_co_users: CoUser[];
};

type RiskReportResponse = {
  review: Review;
  context?: SubmissionContext | null;
};

export function RiskReport() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const fallback = useMemo(() => demoFlaggedReviews.find((review) => review.id === id) || demoFlaggedReviews[0], [id]);
  const [review, setReview] = useState<Review>(fallback);
  const [context, setContext] = useState<SubmissionContext | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    api
      .get<RiskReportResponse>(`/admin/reviews/${id}/risk-report`, token)
      .then((data) => {
        setReview(data.review);
        setContext(data.context || null);
      })
      .catch(() => {
        setReview(fallback);
        setContext(null);
      });
  }, [token, id, fallback]);

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-border bg-card p-6">
        <Badge tone={review.risk_score >= 55 ? "bad" : "warn"}>{review.risk_label}</Badge>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">{review.title}</h2>
        <p className="mt-3 leading-7 text-muted-foreground">{review.body}</p>
        <div className="mt-8 grid gap-3">
          {(review.review_flags || []).map((flag, index) => (
            <div key={`${flag.rule_code}-${index}`} className="rounded-md border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={flag.score_impact >= 10 ? "bad" : flag.score_impact >= 7 ? "warn" : "neutral"}>
                      {flag.category}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">{flag.rule_code}</span>
                  </div>
                  <p className="mt-2 font-semibold">{flag.reason}</p>
                </div>
                <span className="font-mono text-primary">+{flag.score_impact}</span>
              </div>
            </div>
          ))}
          {(review.review_flags || []).length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No Sentra rules fired for this review.
            </p>
          ) : null}
        </div>
      </section>
      <aside className="grid gap-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Final fraud score</p>
          <p className="mt-2 font-mono text-6xl font-semibold">{review.risk_score}</p>
          <div className="mt-6 grid gap-3 text-sm">
            <p>
              <span className="text-muted-foreground">Reviewer: </span>
              {review.profiles?.username ? (
                <Link className="text-primary hover:underline" href={`/admin/users/${review.user_id}`}>@{review.profiles.username}</Link>
              ) : (
                "Unknown"
              )}
            </p>
            <p>
              <span className="text-muted-foreground">Product:</span> {review.products?.name || review.product_id}
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span> {review.status}
            </p>
            <p>
              <span className="text-muted-foreground">Verified purchase:</span> {review.is_verified_purchase ? "Yes" : "No"}
            </p>
            {context && typeof context.account_age_days === "number" ? (
              <p>
                <span className="text-muted-foreground">Account age:</span> {context.account_age_days} days
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Submission context</p>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Fingerprint className="mt-0.5 size-4 text-primary" />
              <div className="min-w-0">
                <p className="text-muted-foreground">Device fingerprint</p>
                <p className="font-mono text-xs break-all">{context?.device_fingerprint_short || "(not captured)"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Wifi className="mt-0.5 size-4 text-primary" />
              <div className="min-w-0">
                <p className="text-muted-foreground">IP hash</p>
                <p className="font-mono text-xs break-all">{context?.ip_hash_short || "(not captured)"}</p>
              </div>
            </div>
            {context?.user_agent ? (
              <div>
                <p className="text-muted-foreground">User agent</p>
                <p className="text-xs leading-5 break-words text-foreground/80">{context.user_agent}</p>
              </div>
            ) : null}
          </div>
          {context && context.device_co_users.length > 0 ? (
            <div className="mt-5 rounded-md border border-danger/30 bg-danger/5 p-3">
              <p className="text-xs font-semibold text-danger">Other accounts on the same device or IP</p>
              <ul className="mt-2 grid gap-1.5">
                {context.device_co_users.map((peer) => (
                  <li key={peer.user_id} className="flex items-center justify-between gap-2 text-xs">
                    <Link className="text-primary hover:underline" href={`/admin/users/${peer.user_id}`}>
                      @{peer.username || peer.user_id.slice(0, 6)}
                    </Link>
                    <span className="font-mono text-muted-foreground">{peer.shared.join("+")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
