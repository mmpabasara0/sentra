"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

export function ReviewForm({ productId }: { productId: string }) {
  const { token } = useAuth();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ risk_score: number; risk_label: string; status: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!token) {
      setError("Sign in before submitting a review.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<{ review: { risk_score: number; risk_label: string; status: string } }>(
        `/products/${productId}/reviews`,
        { rating, title, body, device_fingerprint: getDeviceFingerprint() },
        token,
      );
      setResult(data.review);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review submission failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="review-card grid gap-4 rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Write a product review</h2>
        <p className="mt-1 text-sm text-muted-foreground">Share what arrived, how it worked, and who it is best for.</p>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Rating
        <select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="min-h-11 rounded-md border border-border bg-card px-3 outline-none ring-primary/25 focus:border-primary focus:ring-4">
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Review title
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Comfortable for daily use" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Review text
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Mention fit, finish, delivery, value, and anything a buyer should know." />
      </label>
      {error ? <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
      {result ? (
        <div className="review-result rounded-md bg-muted p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" />
            <strong>Review received:</strong>
            <Badge tone={result.risk_score >= 60 ? "bad" : result.risk_score >= 30 ? "warn" : "good"}>{result.risk_label}</Badge>
          </div>
          <p className="mt-2 text-muted-foreground">Status: {result.status === "published" ? "Published" : "Queued for quality review"}</p>
        </div>
      ) : null}
      <Button disabled={loading}><Star className="size-4" /> {loading ? "Submitting..." : "Submit review"}</Button>
    </form>
  );
}
