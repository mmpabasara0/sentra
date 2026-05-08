"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Edit3, PackagePlus, RefreshCw, Trash2 } from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useNotifications } from "@/context/notification-context";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/services/api";

function approvalTone(status?: string) {
  if (status === "approved") return "good";
  if (status === "rejected" || status === "archived") return "bad";
  return "warn";
}

export default function SellerProductsPage() {
  const { token } = useAuth();
  const { notify } = useNotifications();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [archiving, setArchiving] = useState<string | null>(null);
  const prevStatusRef = useRef<Record<string, string>>({});

  const loadProducts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.get<{ products: Product[] }>("/seller/products", token);
      // Notify on approval status changes since last load.
      const prev = prevStatusRef.current;
      data.products.forEach((p) => {
        const oldStatus = prev[p.id];
        if (oldStatus && oldStatus !== p.approval_status) {
          if (p.approval_status === "approved") {
            notify({ category: "seller", type: "product_approved", title: "Product approved", message: `"${p.name}" is now live in the NovaMart catalog.`, href: "/seller/products" });
          } else if (p.approval_status === "rejected") {
            notify({ category: "seller", type: "product_rejected", title: "Product rejected", message: `"${p.name}" was rejected by admin. Check the reason and resubmit.`, href: "/seller/products" });
          }
        }
      });
      prevStatusRef.current = Object.fromEntries(data.products.map((p) => [p.id, p.approval_status || ""]));
      setProducts(data.products);
    } catch (err) {
      setError((err as Error).message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, [token, notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProducts(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  async function deleteProduct(productId: string, productName: string) {
    if (!token) return;
    if (!window.confirm(`Delete "${productName}" from your product list? It will be removed from the store.`)) return;
    setArchiving(productId);
    try {
      await api.delete(`/seller/products/${productId}`, token);
      notify({ category: "seller", type: "info", title: "Product deleted", message: `"${productName}" has been removed from your product list.`, href: "/seller/products" });
      await loadProducts();
    } catch (err) {
      setError((err as Error).message || "Could not delete product.");
    } finally {
      setArchiving(null);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Seller products" eyebrow="Listing management">
        Add products, send changes for review, and track approval decisions from admin.
      </PageHeader>
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Product workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">Approved products appear in the NovaMart catalog.</p>
          </div>
          <Link href="/seller/products/new"><Button><PackagePlus className="size-4" /> Add product</Button></Link>
        </div>

        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <span>{error}</span>
            <Button variant="secondary" onClick={() => void loadProducts()}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
            ))
          ) : (
            products.map((product, index) => (
              <article
                key={product.id}
                className="reveal grid gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] md:grid-cols-[96px_1fr_auto]"
                style={{ "--delay": index } as React.CSSProperties}
              >
                <div className="relative aspect-square w-24 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  <Image
                    src={product.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={approvalTone(product.approval_status)}>
                      {(product.approval_status || "pending_review").replaceAll("_", " ")}
                    </Badge>
                    <Badge tone="neutral">Sentra checked</Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{product.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{product.description}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {product.category} · {formatCurrency(product.price)} · {product.stock} in stock
                  </p>
                  {product.approval_status === "pending_review" ? (
                    <p className="mt-2 text-sm text-warning">Pending admin review. It will go live after approval.</p>
                  ) : product.rejection_reason ? (
                    <p className="mt-2 text-sm text-danger">{product.rejection_reason}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Link href={`/seller/products/${product.id}/edit`}>
                    <Button variant="secondary"><Edit3 className="size-4" /> Edit</Button>
                  </Link>
                  <Button
                    variant="danger"
                    disabled={archiving === product.id}
                    onClick={() => void deleteProduct(product.id, product.name)}
                  >
                    {archiving === product.id ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </article>
            ))
          )}
          {!loading && products.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <PackagePlus className="mx-auto size-8 text-primary" />
              <h2 className="mt-4 text-xl font-semibold">No seller products yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Submit your first listing for admin review.</p>
              <Link href="/seller/products/new" className="mt-5 inline-flex"><Button>Add product</Button></Link>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
