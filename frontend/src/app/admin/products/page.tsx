"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, PackageSearch, XCircle } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/services/api";

export default function AdminPendingProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    const data = await api.get<{ products: Product[] }>("/admin/products/pending", token);
    setProducts(data.products);
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(productId: string, action: "approve" | "reject") {
    if (!token) return;
    await api.post(`/admin/products/${productId}/${action}`, { notes: notes[productId] || "" }, token);
    setProducts((current) => current.filter((product) => product.id !== productId));
  }

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <PackageSearch className="size-3" />
            Product integrity review
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Pending seller products</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Approve seller listings after reviewing price, copy quality, seller trust, and Sentra product risk reasons.
          </p>
        </header>
      <section className="grid gap-4">
        {products.map((product, index) => (
          <article key={product.id} className="reveal grid gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] lg:grid-cols-[120px_1fr_320px]" style={{ "--delay": index } as React.CSSProperties}>
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
              <Image src={product.image_url} alt="" fill className="object-cover" sizes="120px" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={(product.product_risk_score || 0) >= 60 ? "bad" : (product.product_risk_score || 0) >= 30 ? "warn" : "good"}>{product.product_risk_label || "Genuine"}</Badge>
                <span className="font-mono text-sm text-muted-foreground">{product.product_risk_score || 0} risk points</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold">{product.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{product.seller_name} · {product.category} · {formatCurrency(product.price)}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{product.description}</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {(product.product_risk_reasons || []).slice(0, 4).map((reason) => (
                  <div key={`${reason.rule_code}-${reason.reason}`} className="rounded-md bg-muted/40 p-3 text-sm">
                    <p>{reason.reason}</p>
                    <p className="mt-1 font-mono text-xs text-primary">+{reason.score_impact || 0}</p>
                  </div>
                ))}
                {!(product.product_risk_reasons || []).length ? (
                  <p className="text-sm text-muted-foreground">No risk deductions. Open details to review images, seller context, and full listing data.</p>
                ) : null}
              </div>
            </div>
            <div className="grid content-start gap-3">
              <Link href={`/admin/products/${product.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-card/86 px-4 py-2 text-sm font-semibold hover:bg-muted">
                <Eye className="size-4" /> View details
              </Link>
              <Input placeholder="Admin notes" value={notes[product.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [product.id]: event.target.value }))} />
              <Button onClick={() => act(product.id, "approve")}><CheckCircle2 className="size-4" /> Approve product</Button>
              <Button variant="danger" onClick={() => act(product.id, "reject")}><XCircle className="size-4" /> Reject product</Button>
            </div>
          </article>
        ))}
        {products.length === 0 ? (
          <div className="grid min-h-60 place-items-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
            <div>
              <PackageSearch className="mx-auto size-8 text-primary" />
              <h2 className="mt-3 text-sm font-semibold">No pending products</h2>
              <p className="mt-1 text-xs text-muted-foreground">Seller product submissions will appear here.</p>
            </div>
          </div>
        ) : null}
      </section>
      </div>
    </AppShell>
  );
}
