"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  PackagePlus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useNotifications } from "@/context/notification-context";
import type { Product, Review, Seller } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/services/api";

type DashboardData = {
  seller: Seller;
  cards: {
    products: number;
    pending_products: number;
    orders: number;
    revenue: number;
    flagged_reviews: number;
    sentra_alerts: number;
  };
  recent_orders: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    orders?: { id: string; status: string; created_at: string };
    products?: Pick<Product, "name" | "image_url">;
  }>;
  recent_reviews: Review[];
  products: Product[];
  revenue_by_day?: Array<{ date: string; revenue: number }>;
  product_status_counts?: { approved: number; pending_review: number; rejected: number; archived: number };
  review_risk_counts?: { Genuine: number; Suspicious: number; "High Risk": number };
};

const RISK_COLORS: Record<string, string> = {
  Genuine: "var(--color-success, #22c55e)",
  Suspicious: "var(--color-warning, #f59e0b)",
  "High Risk": "var(--color-danger, #ef4444)",
};
const STATUS_COLORS: Record<string, string> = {
  approved: "var(--color-success, #22c55e)",
  pending_review: "var(--color-warning, #f59e0b)",
  rejected: "var(--color-danger, #ef4444)",
  archived: "var(--color-muted-foreground, #6b7280)",
};

function DashboardSkeleton() {
  return (
    <section className="grid w-full gap-6 px-5 py-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    </section>
  );
}

export default function SellerDashboardPage() {
  const { token } = useAuth();
  const { notify } = useNotifications();
  const [data, setData] = useState<DashboardData | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      api
        .get<DashboardData>("/seller/dashboard", token)
        .then((next) => {
          setData(next);
          setLoading(false);
          // Notify seller about new orders since last visit.
          const storageKey = `novamart-seller-order-count`;
          const lastCount = Number(window.localStorage.getItem(storageKey) || "0");
          const currentCount = next.cards.orders;
          if (lastCount > 0 && currentCount > lastCount) {
            const newCount = currentCount - lastCount;
            notify({ category: "seller", type: "new_order", title: `${newCount} new order${newCount > 1 ? "s" : ""} received`, message: "Customers have purchased your products. Check the orders page.", href: "/seller/orders" });
          }
          window.localStorage.setItem(storageKey, String(currentCount));
          // Notify about Sentra alerts.
          const alertKey = `novamart-seller-alert-count`;
          const lastAlerts = Number(window.localStorage.getItem(alertKey) || "0");
          if (lastAlerts > 0 && next.cards.sentra_alerts > lastAlerts) {
            notify({ category: "seller", type: "sentra_alert", title: "New Sentra risk alert", message: "A product listing has been flagged with a high risk score. Review it in your products page.", href: "/seller/products" });
          }
          window.localStorage.setItem(alertKey, String(next.cards.sentra_alerts));
        })
        .catch((err) => {
          if ((err as Error & { status?: number }).status === 403) setLocked(true);
          setLoading(false);
        });
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (locked) {
    return (
      <AppShell>
        <PageHeader title="Seller verification is required" eyebrow="Seller studio" icon={<Store className="size-4" />}>
          Submit your seller application and wait for admin approval before opening the seller dashboard.
        </PageHeader>
        <section className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-2xl font-semibold">Finish seller verification</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Approved sellers can add products, view seller orders, and monitor Sentra alerts for their listings.
            </p>
            <Link href="/seller/apply" className="mt-6 inline-flex">
              <Button>Go to seller application</Button>
            </Link>
          </div>
        </section>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Seller studio" eyebrow="NovaMart seller workspace" icon={<Store className="size-4" />}>
          Loading your store data...
        </PageHeader>
        <DashboardSkeleton />
      </AppShell>
    );
  }

  const cards = data?.cards;
  const metrics: Array<[string, string | number, LucideIcon]> = [
    ["Revenue", cards ? formatCurrency(cards.revenue) : "LKR 0", ShoppingBag],
    ["Orders", cards?.orders ?? 0, ClipboardCheck],
    ["Products", cards?.products ?? 0, Boxes],
    ["Pending review", cards?.pending_products ?? 0, PackagePlus],
    ["Flagged reviews", cards?.flagged_reviews ?? 0, AlertTriangle],
    ["Sentra alerts", cards?.sentra_alerts ?? 0, Star],
  ];

  const setupChecks: Array<[string, boolean]> = [
    ["Documents verified", true],
    ["Bank details added", Boolean(data?.seller.account_number || data?.seller.account_number_last4)],
    ["First product submitted", Boolean((cards?.products || 0) > 0)],
    ["Sentra trust score visible", true],
  ];
  const setupComplete = setupChecks.filter(([, done]) => done).length;
  const setupProgress = Math.round((setupComplete / setupChecks.length) * 100);

  const priorityActions = [
    {
      title: "Submit your next listing",
      note: cards?.pending_products
        ? `${cards.pending_products} listing(s) already waiting for review`
        : "Keep your catalog growing with clear product details.",
      href: "/seller/products/new",
      cta: "Add listing",
    },
    {
      title: "Polish approved catalog pages",
      note: cards?.products
        ? `${cards.products} product(s) can be improved with richer descriptions.`
        : "No approved products yet — start with your best item first.",
      href: "/seller/products",
      cta: "Open products",
    },
    {
      title: "Monitor trust and alerts",
      note: cards?.sentra_alerts
        ? `${cards.sentra_alerts} alert(s) need your attention.`
        : "No new alerts. Keep response times quick to maintain trust.",
      href: "/seller/reviews",
      cta: "Open review signals",
    },
  ];

  // Build chart data from API or fall back gracefully.
  const revenueChartData = (data?.revenue_by_day || []).map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    revenue: d.revenue,
  }));

  const productStatusData = data?.product_status_counts
    ? Object.entries(data.product_status_counts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k.replaceAll("_", " "), value: v, key: k }))
    : [];

  const reviewRiskData = data?.review_risk_counts
    ? Object.entries(data.review_risk_counts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k, value: v, key: k }))
    : [];

  return (
    <AppShell>
      <PageHeader
        title={data ? `${data.seller.store_name} seller studio` : "Seller studio"}
        eyebrow="NovaMart seller workspace"
        icon={<Store className="size-4" />}
      >
        Manage listings, order activity, and Sentra integrity signals for your store.
      </PageHeader>
      <section className="grid w-full gap-6 px-5 py-10">
        {/* Metric cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {metrics.map(([label, value, Icon], index) => (
            <div
              key={String(label)}
              className="reveal rounded-lg border border-border bg-card p-4"
              style={{ "--delay": index } as React.CSSProperties}
            >
              <Icon className="mb-4 size-5 text-primary" />
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        {/* Analytics charts */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue by day */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] lg:col-span-1">
            <h2 className="text-base font-semibold">Revenue — last 7 days</h2>
            <p className="mt-1 text-xs text-muted-foreground">Daily sales from approved products</p>
            <div className="mt-4 h-40">
              {revenueChartData.some((d) => d.revenue > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v) => [formatCurrency(Number(v ?? 0)), "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No sales data yet</div>
              )}
            </div>
          </div>

          {/* Product status donut */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-base font-semibold">Product status</h2>
            <p className="mt-1 text-xs text-muted-foreground">Distribution across approval states</p>
            <div className="mt-2 flex items-center gap-4">
              <div className="h-36 w-36 flex-shrink-0">
                {productStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={productStatusData} cx="50%" cy="50%" innerRadius={32} outerRadius={60} paddingAngle={3} dataKey="value">
                        {productStatusData.map((entry) => (
                          <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || "#6b7280"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No products</div>
                )}
              </div>
              <div className="grid gap-1.5 text-xs">
                {productStatusData.map((entry) => (
                  <div key={entry.key} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[entry.key] || "#6b7280" }} />
                    <span className="capitalize text-muted-foreground">{entry.name}</span>
                    <span className="font-semibold">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Review risk donut */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-base font-semibold">Review risk signals</h2>
            <p className="mt-1 text-xs text-muted-foreground">Sentra classification breakdown</p>
            <div className="mt-2 flex items-center gap-4">
              <div className="h-36 w-36 flex-shrink-0">
                {reviewRiskData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={reviewRiskData} cx="50%" cy="50%" innerRadius={32} outerRadius={60} paddingAngle={3} dataKey="value">
                        {reviewRiskData.map((entry) => (
                          <Cell key={entry.key} fill={RISK_COLORS[entry.key] || "#6b7280"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No reviews yet</div>
                )}
              </div>
              <div className="grid gap-1.5 text-xs">
                {reviewRiskData.map((entry) => (
                  <div key={entry.key} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full flex-shrink-0" style={{ background: RISK_COLORS[entry.key] || "#6b7280" }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                    <span className="font-semibold">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Store setup + Product approval */}
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Store setup</h2>
                <p className="mt-1 text-sm text-muted-foreground">Keep the selling account presentation-ready.</p>
              </div>
              <Badge tone="good">{data?.seller.status || "active"}</Badge>
            </div>
            <div className="mt-5 grid gap-3">
              {setupChecks.map(([label, done]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-md bg-muted/35 px-4 py-3 text-sm">
                  <span>{label}</span>
                  {done ? (
                    <BadgeCheck className="size-4 text-success" />
                  ) : (
                    <span className="text-muted-foreground">Pending</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${setupProgress}%` }} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/seller/products/new">
                <Button><PackagePlus className="size-4" /> Add product</Button>
              </Link>
              <Link href="/seller/products">
                <Button variant="secondary">Manage products</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Product approval status</h2>
                <p className="mt-1 text-sm text-muted-foreground">Seller products stay private until admin approval.</p>
              </div>
              <Link href="/seller/products" className="text-sm font-semibold text-primary">View all</Link>
            </div>
            <div className="mt-5 divide-y divide-border">
              {(data?.products || []).slice(0, 6).map((product) => (
                <div key={product.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.category} · {formatCurrency(product.price)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        product.approval_status === "approved"
                          ? "good"
                          : product.approval_status === "rejected"
                          ? "bad"
                          : "warn"
                      }
                    >
                      {(product.approval_status || "pending_review").replaceAll("_", " ")}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Sentra checked</span>
                  </div>
                </div>
              ))}
              {data && data.products.length === 0 ? (
                <div className="grid gap-3 py-6">
                  <p className="text-sm text-muted-foreground">
                    No products submitted yet. Start with one high-quality listing and send it for approval.
                  </p>
                  <Link href="/seller/products/new" className="inline-flex">
                    <Button><PackagePlus className="size-4" /> Create first product</Button>
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Recent orders + Sentra review signals */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-xl font-semibold">Recent seller orders</h2>
            <div className="mt-4 grid gap-3">
              {(data?.recent_orders || []).slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/35 p-3 text-sm">
                  <span>{item.products?.name || "Product"} · Qty {item.quantity}</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(Number(item.unit_price) * Number(item.quantity))}
                  </span>
                </div>
              ))}
              {data && data.recent_orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Seller orders will appear after customers buy approved products.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-xl font-semibold">Sentra review signals</h2>
            <div className="mt-4 grid gap-3">
              {(data?.recent_reviews || []).slice(0, 5).map((review) => (
                <div key={review.id} className="rounded-md bg-muted/35 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{review.title || "Customer review"}</span>
                    <Badge
                      tone={review.risk_score >= 60 ? "bad" : review.risk_score >= 30 ? "warn" : "good"}
                    >
                      {review.risk_label}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-muted-foreground">{review.body}</p>
                </div>
              ))}
              {data && data.recent_reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Review risk reports appear when customers review your products.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        {/* Workspace priorities + Readiness snapshot */}
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Workspace priorities</h2>
              <Badge tone="warn">This week</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {priorityActions.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
                  <Link href={item.href} className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
                    {item.cta}
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-xl font-semibold">Readiness snapshot</h2>
            <div className="mt-4 grid gap-4">
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="text-sm text-muted-foreground">Store setup completion</p>
                <p className="mt-1 text-3xl font-semibold">{setupProgress}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${setupProgress}%` }} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <Activity className="size-5 text-primary" />
                  <p className="mt-2 text-sm text-muted-foreground">Pending approvals</p>
                  <p className="text-2xl font-semibold">{cards?.pending_products ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <ShieldCheck className="size-5 text-primary" />
                  <p className="mt-2 text-sm text-muted-foreground">Trust alerts</p>
                  <p className="text-2xl font-semibold">{cards?.sentra_alerts ?? 0}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
