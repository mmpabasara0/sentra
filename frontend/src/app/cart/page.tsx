"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { getProductImage } from "@/components/customer/product-grid";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/cart-context";
import { formatLkr } from "@/lib/currency";

export default function CartPage() {
  const { items, totalAmount, loading, updateQuantity, removeItem, setOpen } = useCart();

  return (
    <AppShell>
      <PageHeader title="Shopping cart" eyebrow="Ready when you are">Review quantities, remove anything you changed your mind about, then continue to mock payment.</PageHeader>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-32 rounded-xl bg-muted shimmer" />)
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="grid min-h-80 place-items-center rounded-xl border border-dashed border-border bg-card/55 p-8 text-center">
              <div>
                <div className="mx-auto grid size-16 place-items-center rounded-xl bg-muted">
                  <ShoppingBag className="size-7 text-primary" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">Your cart is empty</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Add a few NovaMart products and they will update here and in the side cart instantly.</p>
                <Link href="/products"><Button className="mt-5">Browse catalog</Button></Link>
              </div>
            </div>
          ) : null}

          {items.map((item) => (
            <article key={item.id} className="cart-line-item grid gap-4 rounded-xl border border-border bg-card/70 p-4 shadow-[var(--shadow-soft)] md:grid-cols-[120px_1fr_auto] md:items-center">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <Image src={getProductImage(item.products)} alt={item.products.name} fill className="object-cover" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{item.products.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.products.seller_name}</p>
                <div className="mt-4 flex w-fit items-center rounded-md border border-border bg-card">
                  <button type="button" aria-label="Decrease quantity" onClick={() => void updateQuantity(item.id, item.quantity - 1)} className="grid size-10 place-items-center hover:bg-muted">
                    <Minus className="size-4" />
                  </button>
                  <span className="w-12 text-center font-mono">{item.quantity}</span>
                  <button type="button" aria-label="Increase quantity" onClick={() => void updateQuantity(item.id, item.quantity + 1)} className="grid size-10 place-items-center hover:bg-muted">
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
              <div className="grid justify-start gap-3 md:justify-items-end">
                <p className="font-mono text-xl font-semibold">{formatLkr(Number(item.products.price) * item.quantity)}</p>
                <button type="button" onClick={() => void removeItem(item.id)} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/10">
                  <Trash2 className="size-4" /> Remove
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)] lg:sticky lg:top-28">
          <h2 className="text-xl font-semibold tracking-tight">Order summary</h2>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatLkr(totalAmount)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>Calculated at checkout</span></div>
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-mono text-2xl font-semibold">{formatLkr(totalAmount)}</span>
              </div>
            </div>
          </div>
          <Link href="/checkout"><Button className="mt-5 w-full" disabled={items.length === 0}>Continue to checkout</Button></Link>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setOpen(true)}>Open side cart</Button>
        </aside>
      </section>
    </AppShell>
  );
}
