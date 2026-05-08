"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck, Store, XCircle } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/services/api";
import { useAuth } from "@/context/auth-context";

type AdminProduct = Product & {
  sellers?: { store_name?: string; trust_score?: number; status?: string };
};

function riskTone(score?: number): "good" | "warn" | "bad" {
  if ((score || 0) >= 60) return "bad";
  if ((score || 0) >= 30) return "warn";
  return "good";
}

export default function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.get<{ product: AdminProduct }>(`/admin/products/${id}`, token);
      setProduct(data.product);
      setSelectedImage(data.product.product_images?.[0] || data.product.image_url);
    } catch (err) {
      setError((err as Error).message || "Could not load product.");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const images = useMemo(() => {
    if (!product) return [];
    const list = product.product_images?.length ? product.product_images : [product.image_url];
    return Array.from(new Set(list.filter(Boolean)));
  }, [product]);

  async function act(action: "approve" | "reject") {
    if (!token || !product) return;
    setBusy(action);
    setError("");
    try {
      await api.post(`/admin/products/${product.id}/${action}`, { notes }, token);
      router.push("/admin/products");
    } catch (err) {
      setError((err as Error).message || `Could not ${action} product.`);
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <Link href="/admin/products" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to pending products
        </Link>

        {error ? <div className="mt-5 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

        {loading ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="h-96 rounded-xl bg-muted shimmer" />
            <div className="h-96 rounded-xl bg-muted shimmer" />
          </div>
        ) : !product ? (
          <div className="mt-6 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Product not found.</div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <section className="grid gap-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted shadow-[var(--shadow-soft)]">
                <Image src={selectedImage || product.image_url} alt={product.name} fill priority className="object-contain" sizes="(max-width: 1024px) 100vw, 50vw" />
              </div>
              <div className="grid grid-cols-4 gap-3 md:grid-cols-6">
                {images.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(src)}
                    className={`relative aspect-square overflow-hidden rounded-lg border bg-muted ${selectedImage === src ? "border-primary" : "border-border"}`}
                  >
                    <Image src={src} alt={`${product.name} image ${index + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            </section>

            <section className="grid content-start gap-4">
              <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={product.approval_status === "approved" ? "good" : product.approval_status === "rejected" ? "bad" : "warn"}>
                    {(product.approval_status || "pending_review").replaceAll("_", " ")}
                  </Badge>
                  <Badge tone={riskTone(product.product_risk_score)}>{product.product_risk_label || "Genuine"}</Badge>
                  <span className="font-mono text-sm text-muted-foreground">{product.product_risk_score || 0} risk points</span>
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">{product.name}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {product.category} · {formatCurrency(product.price)} · {product.stock} in stock
                </p>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{product.description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5">
                  <Store className="size-5 text-primary" />
                  <h2 className="mt-3 font-semibold">Seller context</h2>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <p>Store: <span className="text-foreground">{product.sellers?.store_name || product.seller_name}</span></p>
                    <p>Trust score: <span className="font-mono text-foreground">{product.sellers?.trust_score ?? "—"}</span></p>
                    <p>Status: <span className="text-foreground">{product.sellers?.status || "—"}</span></p>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <ShieldCheck className="size-5 text-primary" />
                  <h2 className="mt-3 font-semibold">Sentra product screening</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Admin-only breakdown. Product risk points start at 0; higher points mean more moderation concern.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold">Good signals and risk reasons</h2>
                <div className="mt-4 grid gap-2">
                  {(product.product_risk_reasons || []).length ? (
                    product.product_risk_reasons?.map((reason) => (
                      <div key={`${reason.rule_code}-${reason.reason}`} className="rounded-lg bg-muted/40 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Badge tone="neutral">{reason.category || "Rule"}</Badge>
                            <p className="mt-2">{reason.reason}</p>
                            {reason.rule_code ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{reason.rule_code}</p> : null}
                          </div>
                          <span className="font-mono text-danger">+{reason.score_impact || 0}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg bg-success/10 p-3 text-sm text-success">
                      No risk deductions were found. Product copy, seller state, and listing shape look acceptable.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold">Decision</h2>
                <Input className="mt-3" placeholder="Admin notes for seller" value={notes} onChange={(event) => setNotes(event.target.value)} />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Button disabled={!!busy} onClick={() => void act("approve")}>
                    <CheckCircle2 className="size-4" /> {busy === "approve" ? "Approving..." : "Approve product"}
                  </Button>
                  <Button variant="danger" disabled={!!busy} onClick={() => void act("reject")}>
                    <XCircle className="size-4" /> {busy === "reject" ? "Rejecting..." : "Reject product"}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
