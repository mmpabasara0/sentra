"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";

/* ─── types ───────────────────────────────────────────── */
type Flag = {
  category: string;
  rule_code: string;
  reason: string;
  score_impact: number;
};

type Analysis = {
  risk_score: number;
  risk_label: string;
  status: string;
  category_scores: Record<string, number>;
  flags: Flag[];
};

type Targets = {
  products: { id: string; name: string; average_rating: number }[];
  profiles: { id: string; full_name: string; username: string; role: string; status: string }[];
};

/* ─── presets ─────────────────────────────────────────── */
const PRESETS: { label: string; rating: number; title: string; body: string; tone: "good" | "warn" | "bad" }[] = [
  {
    label: "Genuine review",
    rating: 4,
    title: "Solid build, smooth daily use",
    body: "I've been using this for about three weeks now. The build feels solid, the battery comfortably lasts a full work day, and the carrying pouch was a nice touch. Would buy again from this seller.",
    tone: "good",
  },
  {
    label: "Suspicious — too short and generic",
    rating: 5,
    title: "Best ever",
    body: "good product",
    tone: "warn",
  },
  {
    label: "High risk — promotional spam",
    rating: 5,
    title: "AMAZING MUST BUY",
    body: "Amazing amazing amazing best best best perfect product guaranteed must buy life changing!!! visit https://promo.example.com",
    tone: "bad",
  },
  {
    label: "Sentiment mismatch (5 stars, negative wording)",
    rating: 5,
    title: "Five stars",
    body: "This was a complete waste of money. The build is broken, terrible quality, and customer support has been awful for two weeks straight.",
    tone: "warn",
  },
];

/* ─── helpers ─────────────────────────────────────────── */
function toneForLabel(label: string): "good" | "warn" | "bad" | "neutral" {
  const l = label.toLowerCase();
  if (l.includes("high")) return "bad";
  if (l.includes("suspicious") || l.includes("moderate")) return "warn";
  if (l.includes("genuine") || l.includes("trusted")) return "good";
  return "neutral";
}

function scoreColor(score: number) {
  if (score >= 60) return "var(--danger)";
  if (score >= 30) return "var(--warning)";
  return "var(--success)";
}

/* ─── score gauge ─────────────────────────────────────── */
function RiskGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = scoreColor(score);
  return (
    <div className="grid place-items-center">
      <div className="relative size-44">
        <svg viewBox="0 0 100 100" className="size-44 -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 264} 264`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-mono text-4xl font-semibold tracking-tight" style={{ color }}>
              {score}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">/100 risk</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── category breakdown bar ──────────────────────────── */
function CategoryBars({ scores }: { scores: Record<string, number> }) {
  const max = 35;
  const labels: Record<string, string> = {
    text_risk: "Text content",
    profile_risk: "Profile",
    behavior_risk: "Behavior",
    rating_anomaly_risk: "Rating anomaly",
  };
  return (
    <div className="space-y-3">
      {Object.entries(scores).map(([k, v]) => {
        const pct = Math.min(100, (v / max) * 100);
        return (
          <div key={k}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{labels[k] || k}</span>
              <span className="font-mono font-semibold">{v}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, background: scoreColor(v * 3) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── flag pill ───────────────────────────────────────── */
function FlagItem({ flag }: { flag: Flag }) {
  return (
    <li className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={flag.score_impact >= 10 ? "bad" : flag.score_impact >= 7 ? "warn" : "neutral"}>
              {flag.category}
            </Badge>
            <span className="font-mono text-[10px] text-muted-foreground">{flag.rule_code}</span>
          </div>
          <p className="mt-1.5 text-sm">{flag.reason}</p>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold" style={{ color: scoreColor(flag.score_impact * 3) }}>
          +{flag.score_impact}
        </span>
      </div>
    </li>
  );
}

/* ─── main page ───────────────────────────────────────── */
export default function SentraTesterPage() {
  const { token } = useAuth();
  const [targets, setTargets] = useState<Targets | null>(null);
  const [productId, setProductId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get<Targets>("/admin/sentra/sample-targets", token)
      .then((d) => {
        setTargets(d);
        if (d.products[0]) setProductId(d.products[0].id);
      })
      .catch(() => {});
  }, [token]);

  async function runAnalysis() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ analysis: Analysis }>(
        "/admin/sentra/test-review",
        { rating, title, body, product_id: productId || undefined, user_id: userId || undefined },
        token,
      );
      setAnalysis(res.analysis);
    } catch (e) {
      setError((e as Error).message || "Analysis failed.");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  function loadPreset(p: (typeof PRESETS)[number]) {
    setRating(p.rating);
    setTitle(p.title);
    setBody(p.body);
    setAnalysis(null);
  }

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <FlaskConical className="size-3" />
            Sentra engine sandbox
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Live fraud detection tester</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Score arbitrary review text in real time using the same Sentra rules that run in production. No data is persisted — perfect for showing how the engine catches fake reviews.
          </p>
        </header>

        {/* Presets */}
        <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => loadPreset(p)}
              className="group rounded-lg border border-border bg-card/55 p-3 text-left transition-colors hover:bg-card/90"
            >
              <div className="flex items-center gap-2">
                <Sparkles
                  className={
                    p.tone === "good"
                      ? "size-3.5 text-success"
                      : p.tone === "bad"
                        ? "size-3.5 text-danger"
                        : "size-3.5 text-warning"
                  }
                />
                <span className="text-xs font-semibold">{p.label}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">{p.body}</p>
            </button>
          ))}
        </div>

        {/* Main split */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          {/* INPUT SIDE */}
          <section className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
            <h2 className="mb-4 flex items-center gap-2 font-semibold tracking-tight">
              <Zap className="size-4 text-primary" />
              Review input
            </h2>

            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Target product</label>
                  <select
                    className="mt-1 w-full min-h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    {targets?.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    {!targets && <option>Loading…</option>}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Reviewer profile (optional)</label>
                  <select
                    className="mt-1 w-full min-h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  >
                    <option value="">— Use my admin profile —</option>
                    {targets?.profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        @{p.username} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Rating</label>
                <div className="mt-1.5 flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={`grid size-10 place-items-center rounded-md border text-sm font-semibold transition-colors ${
                        rating >= n
                          ? "border-primary bg-primary/14 text-primary"
                          : "border-border bg-background/40 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {n}★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Review title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Optional — short summary"
                  className="mt-1 w-full min-h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Review body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Paste a real or hypothetical customer review here…"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  {body.trim().split(/\s+/).filter(Boolean).length} words · {body.length} characters
                </p>
              </div>

              <Button onClick={runAnalysis} disabled={!body.trim() || loading} className="w-full">
                <Play className="size-4" />
                {loading ? "Analyzing…" : "Run Sentra analysis"}
              </Button>

              {error && (
                <div className="rounded-md border border-danger/30 bg-danger/8 p-3 text-xs text-danger">{error}</div>
              )}
            </div>
          </section>

          {/* OUTPUT SIDE */}
          <section className="grid gap-4">
            {!analysis && !loading && (
              <div className="grid min-h-[400px] place-items-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
                <div>
                  <FlaskConical className="mx-auto size-10 text-primary/60" />
                  <p className="mt-3 text-sm font-semibold">Awaiting review input</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                    Pick a preset or write a custom review, then run the analysis to see the full risk breakdown with all triggered rules.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="grid min-h-[400px] place-items-center rounded-xl border border-border bg-card/55">
                <div className="text-center">
                  <div className="mx-auto size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Running text, profile, behavior &amp; anomaly checks…</p>
                </div>
              </div>
            )}

            {analysis && (
              <>
                {/* Verdict card */}
                <div
                  className="rounded-xl border p-5 shadow-[var(--shadow-soft)]"
                  style={{
                    background: "var(--card)",
                    borderColor:
                      analysis.risk_score >= 60
                        ? "color-mix(in oklab, var(--danger) 35%, transparent)"
                        : analysis.risk_score >= 30
                          ? "color-mix(in oklab, var(--warning) 35%, transparent)"
                          : "color-mix(in oklab, var(--success) 35%, transparent)",
                  }}
                >
                  <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]">
                    <RiskGauge score={analysis.risk_score} />
                    <div>
                      <Badge tone={toneForLabel(analysis.risk_label)}>{analysis.risk_label}</Badge>
                      <h3 className="mt-2 text-2xl font-bold tracking-tight">
                        {analysis.status === "quarantined" && (
                          <span className="inline-flex items-center gap-2">
                            <ShieldAlert className="size-5 text-danger" />
                            Auto-quarantined
                          </span>
                        )}
                        {analysis.status === "flagged" && (
                          <span className="inline-flex items-center gap-2">
                            <AlertTriangle className="size-5 text-warning" />
                            Flagged for moderation
                          </span>
                        )}
                        {analysis.status === "published" && (
                          <span className="inline-flex items-center gap-2">
                            <CheckCircle2 className="size-5 text-success" />
                            Published
                          </span>
                        )}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Sentra raised <span className="font-semibold text-foreground">{analysis.flags.length}</span>{" "}
                        rule{analysis.flags.length === 1 ? "" : "s"} across{" "}
                        <span className="font-semibold text-foreground">
                          {Object.values(analysis.category_scores).filter((v) => v > 0).length}
                        </span>{" "}
                        risk categor{Object.values(analysis.category_scores).filter((v) => v > 0).length === 1 ? "y" : "ies"}.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category bars */}
                <article className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="size-4 text-primary" />
                    Category breakdown
                  </h4>
                  <CategoryBars scores={analysis.category_scores} />
                </article>

                {/* Flags */}
                <article className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <ShieldAlert className="size-4 text-primary" />
                    Triggered rules
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {analysis.flags.length} flag{analysis.flags.length === 1 ? "" : "s"}
                    </span>
                  </h4>
                  {analysis.flags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No rules triggered — this review reads as authentic to Sentra.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {analysis.flags.map((f, i) => (
                        <FlagItem key={i} flag={f} />
                      ))}
                    </ul>
                  )}
                </article>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
