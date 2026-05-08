"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PackageCheck, RefreshCw, Truck } from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useNotifications } from "@/context/notification-context";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/services/api";

type SellerOrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  orders?: { id: string; status: string; fulfilment_status?: string | null; created_at: string; total_amount: number };
  products?: Pick<Product, "name" | "image_url">;
};

const FULFILMENT_STEPS = ["packed", "shipped", "delivered"] as const;
type FulfilmentStep = (typeof FULFILMENT_STEPS)[number];

function fulfilmentTone(step?: string | null): "good" | "warn" | "neutral" {
  if (step === "delivered") return "good";
  if (step === "shipped") return "warn";
  return "neutral";
}

function nextStep(current?: string | null): FulfilmentStep | null {
  if (!current) return "packed";
  const idx = FULFILMENT_STEPS.indexOf(current as FulfilmentStep);
  if (idx === -1 || idx >= FULFILMENT_STEPS.length - 1) return null;
  return FULFILMENT_STEPS[idx + 1];
}

export default function SellerOrdersPage() {
  const { token } = useAuth();
  const { notify } = useNotifications();
  const [orders, setOrders] = useState<SellerOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  async function loadOrders() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.get<{ orders: SellerOrderItem[] }>("/seller/orders", token);
      setOrders(data.orders);
    } catch (err) {
      setError((err as Error).message || "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOrders(); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function markStatus(orderId: string, status: FulfilmentStep) {
    if (!token) return;
    setUpdating(orderId);
    try {
      await api.put(`/seller/orders/${orderId}/status`, { fulfilment_status: status }, token);
      setOrders((prev) =>
        prev.map((item) =>
          item.orders?.id === orderId
            ? { ...item, orders: { ...item.orders!, fulfilment_status: status } }
            : item,
        ),
      );
      notify({
        category: "seller",
        type: "order_update",
        title: `Order marked as ${status}`,
        message: `Order #${orderId.slice(0, 8)} has been updated to ${status}.`,
        href: "/seller/orders",
      });
    } catch {
      // silent — button re-enables
    } finally {
      setUpdating(null);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Seller orders" eyebrow="Fulfilment view" icon={<Truck className="size-4" />}>
        View and manage order lines for your approved products. Mark orders as packed, shipped, or delivered.
      </PageHeader>
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))
        ) : error ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-danger/30 bg-danger/8 p-8 text-center">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" onClick={() => void loadOrders()}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <PackageCheck className="mx-auto size-8 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">No seller orders yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Customer purchases for your products will appear here.</p>
          </div>
        ) : (
          orders.map((item, index) => {
            const fulfilment = item.orders?.fulfilment_status;
            const next = nextStep(fulfilment);
            const orderId = item.orders?.id;
            const isUpdating = updating === orderId;
            return (
              <article
                key={item.id}
                className="reveal grid gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] md:grid-cols-[72px_1fr_auto]"
                style={{ "--delay": index } as React.CSSProperties}
              >
                <div className="relative size-[72px] flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  <Image
                    src={item.products?.image_url || "/products/home-market-hero.svg"}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="72px"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.orders?.status === "paid" ? "good" : "warn"}>{item.orders?.status || "processing"}</Badge>
                    {fulfilment ? (
                      <Badge tone={fulfilmentTone(fulfilment)}>{fulfilment}</Badge>
                    ) : (
                      <Badge tone="neutral">awaiting fulfilment</Badge>
                    )}
                    <span className="font-mono text-xs text-muted-foreground">#{item.orders?.id?.slice(0, 8)}</span>
                    {item.orders?.created_at && (
                      <span className="text-xs text-muted-foreground">{new Date(item.orders.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  <h2 className="mt-3 font-semibold">{item.products?.name || "Product"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Qty {item.quantity} · Unit {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <div className="text-left md:text-right">
                    <p className="text-sm text-muted-foreground">Line total</p>
                    <p className="mt-1 font-mono text-xl font-semibold">
                      {formatCurrency(Number(item.unit_price) * Number(item.quantity))}
                    </p>
                  </div>
                  {orderId && next && (
                    <Button
                      variant="secondary"
                      disabled={isUpdating}
                      onClick={() => void markStatus(orderId, next)}
                      className="text-xs"
                    >
                      {isUpdating ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <PackageCheck className="size-3" />
                      )}
                      Mark {next}
                    </Button>
                  )}
                  {fulfilment === "delivered" && (
                    <span className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                      <PackageCheck className="size-3" /> Delivered
                    </span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </AppShell>
  );
}
