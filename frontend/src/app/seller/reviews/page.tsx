"use client";

import { useEffect, useState } from "react";
import { MessageSquareWarning, RefreshCw } from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import type { Review } from "@/lib/types";
import { api } from "@/services/api";

export default function SellerReviewsPage() {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReviews() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.get<{ reviews: Review[] }>("/seller/reviews", token);
      setReviews(data.reviews);
    } catch (err) {
      setError((err as Error).message || "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReviews(); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AppShell>
      <PageHeader title="Seller product reviews" eyebrow="Sentra review view" icon={<MessageSquareWarning className="size-4" />}>
        See review status, risk labels, and customer feedback for products in your store. Sentra automatically scores each review.
      </PageHeader>
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
          ))
        ) : error ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-danger/30 bg-danger/8 p-8 text-center">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" onClick={() => void loadReviews()}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <MessageSquareWarning className="mx-auto size-8 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">No reviews yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Customer reviews and Sentra labels appear after approved products are purchased.</p>
          </div>
        ) : (
          reviews.map((review, index) => (
            <article
              key={review.id}
              className="reveal rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
              style={{ "--delay": index } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={review.risk_score >= 60 ? "bad" : review.risk_score >= 30 ? "warn" : "good"}>
                    {review.risk_label}
                  </Badge>
                  <span className="font-mono text-sm text-muted-foreground">{review.risk_score}/100</span>
                  <span className="text-sm text-muted-foreground">{review.products?.name}</span>
                </div>
                <Badge
                  tone={
                    review.status === "approved" || review.status === "published"
                      ? "good"
                      : review.status === "rejected" || review.status === "quarantined"
                      ? "bad"
                      : "warn"
                  }
                >
                  {review.status}
                </Badge>
              </div>
              <h2 className="mt-4 text-xl font-semibold">{review.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.body}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                Reviewer: {review.profiles?.full_name || review.profiles?.username || "Customer"}
              </p>
            </article>
          ))
        )}
      </section>
    </AppShell>
  );
}
