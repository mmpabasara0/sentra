"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Headphones,
  Heart,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Truck,
  UserRound,
  X,
} from "lucide-react";

import { getProductImage, getProductPath } from "@/components/customer/product-grid";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { formatLkr } from "@/lib/currency";
import { demoProducts } from "@/lib/demo-data";
import type { Product, Profile } from "@/lib/types";
import { api } from "@/services/api";
import { supabase } from "@/services/supabase";

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  products?: Partial<Product>;
};

type Order = {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items?: OrderItem[];
};

type DashboardTab = "overview" | "orders" | "profile" | "saved" | "help";

const TAB_ORDER: DashboardTab[] = ["overview", "orders", "profile", "saved", "help"];

const DASHBOARD_NAV: Array<{
  label: string;
  tab: DashboardTab;
  icon: React.ElementType;
}> = [
  { label: "Overview", tab: "overview", icon: LayoutDashboard },
  { label: "Orders", tab: "orders", icon: ReceiptText },
  { label: "Profile", tab: "profile", icon: UserRound },
  { label: "Saved items", tab: "saved", icon: Heart },
  { label: "Help center", tab: "help", icon: HelpCircle },
];

function compactId(id: string) {
  return `NM-${id.slice(0, 8).toUpperCase()}`;
}

function fmtDate(value: string) {
  return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium" }).format(new Date(value));
}

function memberSince(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-LK", { year: "numeric", month: "short" }).format(new Date(value));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDashboardHref(tab: DashboardTab) {
  return tab === "overview" ? "/dashboard" : `/dashboard?tab=${tab}`;
}

function ProductMiniCard({ product }: { product: Product }) {
  return (
    <Link
      href={getProductPath(product)}
      className="group overflow-hidden rounded-xl border border-border bg-card/70 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:bg-card/90"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <Image
          src={getProductImage(product)}
          alt={product.name}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="grid gap-2 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <Badge>{product.category}</Badge>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Star className="size-3.5 fill-current text-warning" />
            {Number(product.average_rating).toFixed(1)}
          </span>
        </div>
        <div>
          <p className="line-clamp-1 text-sm font-semibold">{product.name}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.description}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-sm font-semibold">{formatLkr(product.price)}</p>
          <span className="truncate text-[11px] text-muted-foreground">{product.seller_name}</span>
        </div>
      </div>
    </Link>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  delay: number;
}) {
  return (
    <article
      className="reveal rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]"
      style={{ "--delay": delay } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-4 font-mono text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground/65">{sub}</p> : null}
    </article>
  );
}

function OrderRow({ order, href }: { order: Order; href: string }) {
  const firstItem = order.order_items?.[0];
  const product = firstItem?.products as Product | undefined;
  const extra = (order.order_items?.length ?? 0) - 1;

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card/55 p-4 transition-colors hover:bg-card/90"
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {product ? (
          <Image src={getProductImage(product)} alt={product.name || "Order item"} fill className="object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ShoppingBag className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{compactId(order.id)}</span>
          <Badge tone={order.status === "paid" ? "good" : "warn"}>{order.status}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {product?.name || "Products"}
          {extra > 0 ? ` + ${extra} more` : ""}
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <CalendarDays className="size-3" />
          {fmtDate(order.created_at)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold">{formatLkr(order.total_amount)}</p>
        <ArrowRight className="ml-auto mt-2 size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function QuickAction({
  label,
  description,
  href,
  icon: Icon,
  delay,
}: {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  delay: number;
}) {
  return (
    <Link
      href={href}
      className="reveal group rounded-xl border border-border bg-card/60 p-5 transition-all hover:-translate-y-0.5 hover:bg-card/90 hover:shadow-[var(--shadow-soft)]"
      style={{ "--delay": delay } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/14 group-hover:text-primary">
          <Icon className="size-4" />
        </span>
        <ArrowRight className="size-3.5 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <p className="mt-4 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </Link>
  );
}

function DashboardSidebar({
  open,
  onClose,
  initials,
  name,
  email,
  joinedAt,
  activeTab,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  initials: string;
  name: string;
  email: string;
  joinedAt?: string;
  activeTab: DashboardTab;
  onSignOut: () => void;
}) {
  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      ) : null}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card/95 backdrop-blur-xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "lg:static lg:z-auto lg:min-h-[calc(100dvh-65px)] lg:w-72 lg:translate-x-0 lg:bg-card/35 lg:backdrop-blur-none",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Close workspace menu"
        >
          <X className="size-4" />
        </button>

        <div className="border-b border-border p-5 pb-6">
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-base font-bold tracking-wide text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-snug">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              {joinedAt ? (
                <p className="mt-1 text-[10px] text-muted-foreground/70">Member since {memberSince(joinedAt)}</p>
              ) : null}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-4 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Account workspace</p>
          </div>
          <div className="space-y-1">
            {DASHBOARD_NAV.map(({ label, tab, icon: Icon }) => {
              const active = activeTab === tab;
              return (
                <Link
                  key={tab}
                  href={getDashboardHref(tab)}
                  onClick={onClose}
                  className={[
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-primary/14 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                  {active ? <ChevronRight className="ml-auto size-3.5" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-4">
          <div className="rounded-xl border border-primary/20 bg-primary/7 p-4">
            <p className="text-sm font-semibold">Protected by Sentra</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Reviews, sellers, and listings are screened before they reach your cart.
            </p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function DashboardTabs({ activeTab }: { activeTab: DashboardTab }) {
  return (
    <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {DASHBOARD_NAV.map(({ label, tab }) => {
        const active = activeTab === tab;
        return (
          <Link
            key={tab}
            href={getDashboardHref(tab)}
            className={[
              "whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card/65 text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function OrdersPanel({
  orders,
  loading,
  placedOrderId,
}: {
  orders: Order[];
  loading: boolean;
  placedOrderId: string;
}) {
  const orderStats = useMemo(() => {
    const itemCount = orders.reduce(
      (sum, order) => sum + (order.order_items || []).reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    return { itemCount, totalSpent };
  }, [orders]);

  const stats = [
    { label: "Orders", value: orders.length.toString(), Icon: ReceiptText },
    { label: "Items purchased", value: orderStats.itemCount.toString(), Icon: PackageCheck },
    { label: "Total spent", value: formatLkr(orderStats.totalSpent), Icon: Star },
  ];

  return (
    <section className="grid gap-6">
      {placedOrderId ? (
        <div className="rounded-xl border border-primary/35 bg-primary/10 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
              <PackageCheck className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Order placed successfully</h2>
              <p className="text-sm text-muted-foreground">
                Your order {compactId(placedOrderId)} is now part of your account history.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map(({ label, value, Icon }) => (
          <article key={label} className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
            <Icon className="size-5 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-44 rounded-xl bg-muted shimmer" />
          ))}
        </div>
      ) : null}

      {!loading && orders.length === 0 ? (
        <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-border bg-card/55 p-8 text-center">
          <div>
            <ReceiptText className="mx-auto size-10 text-primary" />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">No orders yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Complete checkout and your purchased products, totals, and delivery status will appear here.
            </p>
            <Link href="/products">
              <Button className="mt-5">Shop products</Button>
            </Link>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-5">
          {orders.map((order) => (
            <article key={order.id} className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-lg font-semibold">{compactId(order.id)}</h2>
                    <Badge tone={order.status === "paid" ? "good" : "warn"}>{order.status}</Badge>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" />
                    {formatTimestamp(order.created_at)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-muted-foreground">Order total</p>
                  <p className="font-mono text-2xl font-semibold">{formatLkr(order.total_amount)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {(order.order_items || []).map((item) => {
                  const product = item.products as Product | undefined;
                  return (
                    <div key={item.id} className="grid gap-3 rounded-lg bg-background/35 p-3 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                      <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                        {product ? (
                          <Image
                            src={getProductImage(product)}
                            alt={product.name || "Purchased product"}
                            fill
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        {product?.slug ? (
                          <Link href={getProductPath(product)} className="font-semibold hover:text-primary">
                            {product.name}
                          </Link>
                        ) : (
                          <p className="font-semibold">{product?.name || "Purchased product"}</p>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">
                          Qty {item.quantity} x {formatLkr(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-mono font-semibold">{formatLkr(Number(item.unit_price) * item.quantity)}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 rounded-lg bg-muted/45 p-4 text-sm sm:grid-cols-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <PackageCheck className="size-4 text-success" />
                  Payment received
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="size-4 text-primary" />
                  Packing order
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Truck className="size-4 text-primary" />
                  Delivery estimate: 2-4 days
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProfilePanel() {
  const { profile, session, token, loading, refreshProfile } = useAuth();
  const [form, setForm] = useState({ full_name: "", username: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isAuthenticated = Boolean(session);
  const fallbackName =
    session?.user.user_metadata?.full_name ||
    session?.user.user_metadata?.username ||
    session?.user.email ||
    "NovaMart user";

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      if (profile) {
        setForm({
          full_name: profile.full_name || "",
          username: profile.username || "",
          phone: profile.phone || "",
          address: profile.address || "",
        });
        return;
      }

      if (session) {
        setForm({
          full_name: session.user.user_metadata?.full_name || "",
          username: session.user.user_metadata?.username || session.user.email?.split("@")[0] || "",
          phone: "",
          address: "",
        });
      }
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [profile, session]);

  async function getFreshAccessToken() {
    if (supabase) {
      const { data: refreshedData } = await supabase.auth.refreshSession();
      if (refreshedData.session?.access_token) {
        return refreshedData.session.access_token;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && data.session?.access_token) {
        return data.session.access_token;
      }
    }
    return token;
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const accessToken = await getFreshAccessToken();
      if (!accessToken) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      await api.patch<{ profile: Profile }>(
        "/auth/me",
        {
          full_name: form.full_name,
          username: form.username,
          phone: form.phone,
          address: form.address,
        },
        accessToken,
      );
      await refreshProfile(accessToken);
      setNotice("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.72fr_1fr]">
      <div className="rounded-xl border border-border bg-card/70 p-6 shadow-[var(--shadow-soft)]">
        {loading ? (
          <p className="text-muted-foreground">Loading profile...</p>
        ) : !isAuthenticated ? (
          <p className="text-muted-foreground">Sign in to view profile details.</p>
        ) : (
          <div className="grid gap-4">
            <Badge>{profile?.role || "customer"}</Badge>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {profile?.full_name || profile?.username || fallbackName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{profile?.email || session?.user.email || "Not available"}</p>
            </div>
            <div className="grid gap-3 rounded-xl border border-border bg-background/35 p-4 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-4">
                <span>Username</span>
                <span className="font-medium text-foreground">{profile?.username || form.username || "Not set"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Phone</span>
                <span className="font-medium text-foreground">{profile?.phone || "Not added yet"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Address</span>
                <span className="text-right font-medium text-foreground">{profile?.address || "Not added yet"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={saveProfile} className="rounded-xl border border-border bg-card/70 p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-5">
          <h2 className="text-xl font-semibold tracking-tight">Edit account details</h2>
          <p className="mt-1 text-sm text-muted-foreground">Keep delivery details and profile information ready for checkout.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            Full name
            <Input
              value={form.full_name}
              onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
              placeholder="Your full name"
            />
          </label>
          <label className="grid gap-2 text-sm">
            Username
            <Input
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="Your username"
            />
          </label>
          <label className="grid gap-2 text-sm">
            Phone
            <Input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="Your phone number"
            />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            Address
            <Input
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              placeholder="Your address"
            />
          </label>
        </div>
        {error ? <p className="mt-4 rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
        {notice ? <p className="mt-4 rounded-md bg-success/10 p-3 text-sm text-success">{notice}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
          <span className="text-xs text-muted-foreground">Changes update your account and checkout profile together.</span>
        </div>
      </form>
    </section>
  );
}

function SavedItemsPanel() {
  const picks = demoProducts.slice(0, 6);

  return (
    <section className="grid gap-6">
      <div className="rounded-xl border border-border bg-card/70 p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Saved shelf</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Keep an eye on the products you come back to</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Your shortlist lives here. For now this shelf highlights frequently revisited picks so the dashboard still feels useful while wishlist syncing is being wired in.
            </p>
          </div>
          <Link href="/products">
            <Button variant="secondary">
              <Search className="size-4" />
              Browse catalog
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {picks.map((product) => (
          <ProductMiniCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function HelpPanel() {
  const supportCards = [
    {
      title: "Delivery and tracking",
      body: "Track dispatch updates, delivery windows, and checkout timing from one place.",
      icon: Truck,
    },
    {
      title: "Payments and refunds",
      body: "See how payment confirmation, refund timing, and replacements are handled.",
      icon: ShieldCheck,
    },
    {
      title: "Account and profile",
      body: "Update contact details, delivery addresses, and password access without leaving the workspace.",
      icon: UserRound,
    },
    {
      title: "Seller and review integrity",
      body: "Sentra checks suspicious reviews, product edits, and seller behavior before listings reach you.",
      icon: Store,
    },
  ];

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-border bg-card/70 p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm font-semibold text-primary">Help center</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Answers for the things that usually block checkout</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Most questions on NovaMart are about delivery timing, payment confirmation, or order changes. This workspace keeps those answers close instead of pushing you into a separate page.
          </p>
          <div className="mt-5 grid gap-3">
            {[
              "Orders update here after payment is confirmed.",
              "Delivery estimates are shown per order line once packing begins.",
              "Profile updates apply to future checkouts and review activity.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg bg-background/35 p-3 text-sm text-muted-foreground">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/70 p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-lg font-semibold tracking-tight">Need to do something now?</h3>
          <div className="mt-4 grid gap-3">
            <QuickAction
              label="Open orders"
              description="Jump straight to recent purchases and delivery status."
              href="/dashboard?tab=orders"
              icon={ReceiptText}
              delay={0}
            />
            <QuickAction
              label="Edit profile"
              description="Update delivery details before your next checkout."
              href="/dashboard?tab=profile"
              icon={UserRound}
              delay={1}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {supportCards.map(({ title, body, icon: Icon }) => (
          <article key={title} className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
            <span className="grid size-10 place-items-center rounded-lg bg-primary/12 text-primary">
              <Icon className="size-4" />
            </span>
            <h3 className="mt-4 text-base font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CustomerDashboardWorkspace() {
  const { profile, session, signOut, token } = useAuth();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const mounted = useRef(false);

  const activeTab = useMemo<DashboardTab>(() => {
    const tab = searchParams.get("tab");
    return TAB_ORDER.includes((tab || "overview") as DashboardTab)
      ? ((tab || "overview") as DashboardTab)
      : "overview";
  }, [searchParams]);

  const placedOrderId = searchParams.get("placed") || "";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      const timer = window.setTimeout(() => {
        if (mounted.current) setLoadingOrders(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      api.get<{ orders: Order[] }>("/orders", token)
        .then((data) => {
          if (mounted.current) setOrders(data.orders);
        })
        .catch(() => {
          if (mounted.current) setOrders([]);
        })
        .finally(() => {
          if (mounted.current) setLoadingOrders(false);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [token]);

  const stats = useMemo(() => {
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const itemCount = orders.reduce(
      (sum, order) => sum + (order.order_items ?? []).reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    return { totalSpent, itemCount };
  }, [orders]);

  const name =
    profile?.full_name ||
    profile?.username ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.username ||
    "You";
  const email = profile?.email || session?.user?.email || "";
  const initials = name
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const firstName = name.split(" ")[0];

  const quickActions = [
    {
      label: "Browse products",
      description: "Discover new arrivals and deals across all categories.",
      href: "/products",
      icon: ShoppingBag,
    },
    {
      label: "Track an order",
      description: "View order status, items, and delivery estimates.",
      href: "/dashboard?tab=orders",
      icon: Truck,
    },
    {
      label: "Saved items",
      description: "Keep shortlisted products close while you compare options.",
      href: "/dashboard?tab=saved",
      icon: Heart,
    },
    {
      label: "Update profile",
      description: "Edit your contact details and delivery address.",
      href: "/dashboard?tab=profile",
      icon: UserRound,
    },
  ];

  const tabCopy: Record<DashboardTab, { eyebrow: string; title: string; description: string }> = {
    overview: {
      eyebrow: "Your NovaMart",
      title: `Welcome back, ${firstName}`,
      description: "Everything tied to shopping, delivery, and account details now lives inside this workspace.",
    },
    orders: {
      eyebrow: "Orders",
      title: "Track purchases without leaving the dashboard",
      description: "Recent totals, line items, payment status, and delivery progress stay here with the rest of your account.",
    },
    profile: {
      eyebrow: "Profile",
      title: "Update account details in-place",
      description: "Keep checkout details, contact info, and addresses current without bouncing into a separate profile page.",
    },
    saved: {
      eyebrow: "Saved items",
      title: "Keep your shortlist close",
      description: "Compare products you might come back to, then jump straight into the catalog when you’re ready.",
    },
    help: {
      eyebrow: "Help center",
      title: "Support, delivery, and account answers",
      description: "The common support paths stay inside the workspace so it feels like one coherent account area.",
    },
  };

  const currentTabCopy = tabCopy[activeTab];

  return (
    <AppShell>
      <div className="flex min-h-[calc(100dvh-65px)]">
        <DashboardSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          initials={initials}
          name={name}
          email={email}
          joinedAt={session?.user?.created_at}
          activeTab={activeTab}
          onSignOut={signOut}
        />

        <div className="min-w-0 flex-1">
          <div className="border-b border-border bg-card/28">
            <div className="px-4 py-5 md:px-6 lg:px-8">
              <div className="mb-4 flex items-center gap-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="grid size-10 place-items-center rounded-lg border border-border bg-card/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Open workspace menu"
                >
                  <Menu className="size-5" />
                </button>
                <p className="text-sm font-semibold text-muted-foreground">Account workspace</p>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary/80">
                    {currentTabCopy.eyebrow}
                  </p>
                  <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
                    {currentTabCopy.title}
                  </h1>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground xl:justify-self-end">
                  {currentTabCopy.description}
                </p>
              </div>

              <div className="mt-5">
                <DashboardTabs activeTab={activeTab} />
              </div>
            </div>
          </div>

          <div className="px-4 py-6 md:px-6 lg:px-8 lg:py-8">
            {activeTab === "overview" ? (
              <div className="grid gap-8">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Total orders"
                    value={loadingOrders ? "—" : orders.length.toString()}
                    icon={ReceiptText}
                    delay={0}
                  />
                  <StatCard
                    label="Items purchased"
                    value={loadingOrders ? "—" : stats.itemCount.toString()}
                    icon={PackageCheck}
                    delay={1}
                  />
                  <StatCard
                    label="Total spent"
                    value={loadingOrders ? "—" : formatLkr(stats.totalSpent)}
                    icon={Star}
                    delay={2}
                  />
                  <StatCard
                    label="Account status"
                    value="Active"
                    sub={profile?.role ? `Role: ${profile.role}` : undefined}
                    icon={Store}
                    delay={3}
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-semibold tracking-tight">Recent orders</h2>
                      <Link
                        href="/dashboard?tab=orders"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        View all
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>

                    {loadingOrders ? (
                      <div className="grid gap-3">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="h-20 rounded-xl bg-muted shimmer" />
                        ))}
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
                        <div>
                          <ReceiptText className="mx-auto size-8 text-primary/60" />
                          <p className="mt-3 text-sm font-medium">No orders yet</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Complete your first checkout and it will appear here.
                          </p>
                          <Link href="/products">
                            <Button className="mt-4">Start shopping</Button>
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {orders.slice(0, 5).map((order) => (
                          <OrderRow key={order.id} order={order} href="/dashboard?tab=orders" />
                        ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <h2 className="mb-4 font-semibold tracking-tight">Quick actions</h2>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      {quickActions.map((action, index) => (
                        <QuickAction key={action.label} {...action} delay={index} />
                      ))}
                    </div>
                  </section>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/6 p-4">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/14 text-primary">
                    <ShieldCheck className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Protected by Sentra</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      Every review and product listing on NovaMart is screened by the Sentra integrity engine before it reaches checkout.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "orders" ? <OrdersPanel orders={orders} loading={loadingOrders} placedOrderId={placedOrderId} /> : null}
            {activeTab === "profile" ? <ProfilePanel /> : null}
            {activeTab === "saved" ? <SavedItemsPanel /> : null}
            {activeTab === "help" ? <HelpPanel /> : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function DashboardFallback() {
  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-65px)] px-4 py-8 md:px-6 lg:px-8">
        <div className="h-10 w-56 rounded-xl bg-muted shimmer" />
        <div className="mt-6 h-24 rounded-2xl bg-muted shimmer" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-xl bg-muted shimmer" />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default function CustomerDashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <CustomerDashboardWorkspace />
    </Suspense>
  );
}
