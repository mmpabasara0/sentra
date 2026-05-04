"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2, X } from "lucide-react";

import { getProductImage } from "@/components/customer/product-grid";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { formatLkr } from "@/lib/currency";
import { cn } from "@/lib/utils";

export function CartDrawer() {
  const { session } = useAuth();
  const {
    items,
    totalCount,
    totalAmount,
    open,
    loading,
    busyItemId,
    notice,
    lastAdded,
    setOpen,
    updateQuantity,
    removeItem,
  } = useCart();

  return (
    <div className={cn("fixed inset-0 z-40 pointer-events-none", open && "pointer-events-auto")}>
      <button
        type="button"
        aria-label="Close cart drawer"
        onClick={() => setOpen(false)}
        className={cn(
          "absolute inset-0 bg-background/70 opacity-0 backdrop-blur-sm transition-opacity duration-300",
          open && "opacity-100",
        )}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-md translate-x-full flex-col border-l border-border bg-card shadow-[var(--shadow-soft)] transition-transform duration-300 ease-[var(--ease-out)] sm:rounded-l-xl",
          open && "translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">NovaMart cart</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{totalCount} item{totalCount === 1 ? "" : "s"}</h2>
          </div>
          <button type="button" aria-label="Close cart" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-md border border-border hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        {lastAdded ? (
          <div className="cart-added-flash mx-4 mt-4 flex items-center gap-3 rounded-lg border border-primary/35 bg-primary/10 p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShoppingBag className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{lastAdded.name}</p>
              <p className="text-xs text-muted-foreground">Added to your shopping bag</p>
            </div>
          </div>
        ) : null}

        {notice ? (
          <p className="mx-4 mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">{notice}</p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && items.length === 0 ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 rounded-lg bg-muted shimmer" />
              ))}
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="grid h-full place-items-center rounded-xl border border-dashed border-border p-8 text-center">
              <div>
                <div className="mx-auto grid size-14 place-items-center rounded-xl bg-muted">
                  <ShoppingBag className="size-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Your cart is waiting</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Add products from the storefront and they will appear here instantly.</p>
                <Link href="/products" onClick={() => setOpen(false)}>
                  <Button className="mt-5">Browse products</Button>
                </Link>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3">
            {items.map((item) => (
              <article key={item.id} className="cart-line-item grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-border bg-background/35 p-3">
                <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  <Image src={getProductImage(item.products)} alt={item.products.name} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{item.products.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{formatLkr(item.products.price)}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.products.name}`}
                      onClick={() => void removeItem(item.id)}
                      disabled={busyItemId === item.id}
                      className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-md border border-border bg-card">
                      <button type="button" aria-label="Decrease quantity" onClick={() => void updateQuantity(item.id, item.quantity - 1)} className="grid size-8 place-items-center hover:bg-muted">
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-9 text-center font-mono text-sm">{item.quantity}</span>
                      <button type="button" aria-label="Increase quantity" onClick={() => void updateQuantity(item.id, item.quantity + 1)} className="grid size-8 place-items-center hover:bg-muted">
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <p className="font-mono text-sm font-semibold">{formatLkr(Number(item.products.price) * item.quantity)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-4 rounded-lg bg-muted/55 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono font-semibold">{formatLkr(totalAmount)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              Secure checkout available for this order.
            </div>
          </div>
          {!session ? (
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button className="w-full">Sign in to checkout</Button>
            </Link>
          ) : (
            <Link href="/checkout" onClick={() => setOpen(false)}>
              <Button className="w-full" disabled={items.length === 0}>Checkout securely</Button>
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
