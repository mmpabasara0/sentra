"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, CreditCard, LockKeyhole, MapPin, ShieldCheck, Truck } from "lucide-react";

import { getProductImage } from "@/components/customer/product-grid";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useNotifications } from "@/context/notification-context";
import { formatLkr } from "@/lib/currency";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

const steps = ["Delivery", "Payment", "Review"];

export default function CheckoutPage() {
  const { token, profile, session } = useAuth();
  const { items, totalAmount, refreshCart } = useCart();
  const { notify } = useNotifications();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [form, setForm] = useState({
    name: profile?.full_name || session?.user.email?.split("@")[0] || "",
    phone: profile?.phone || "",
    address: profile?.address || "",
    cardName: profile?.full_name || "",
    cardNumber: "4242 4242 4242 4242",
    expiry: "12/29",
    cvc: "123",
  });

  async function checkout(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      setMessage("Sign in before checkout.");
      return;
    }
    if (items.length === 0) {
      setMessage("Add at least one product before checkout.");
      return;
    }

    setMessage("");
    setProcessing(true);
    setPaymentComplete(false);
    window.setTimeout(() => setPaymentComplete(true), 900);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const data = await api.post<{ order_id: string }>("/orders", {}, token);
      await refreshCart();
      notify({
        category: "customer",
        type: "order_placed",
        title: "Order placed successfully",
        message: `Your order has been confirmed. Track it in your orders page.`,
        href: `/orders?placed=${data.order_id}`,
      });
      router.push(`/orders?placed=${data.order_id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed.");
      setProcessing(false);
      setPaymentComplete(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Checkout" eyebrow="Secure payment">Review delivery details, authorize the payment, and place your NovaMart order.</PageHeader>
      <form onSubmit={checkout} className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1fr_390px]">
        <div className="grid content-start gap-5">
          <div className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap gap-2">
              {steps.map((step, index) => (
                <span key={step} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-2 text-sm font-semibold">
                  <span className={cn("grid size-6 place-items-center rounded-full bg-card text-xs", index === 0 && "bg-primary text-primary-foreground")}>{index + 1}</span>
                  {step}
                </span>
              ))}
            </div>
          </div>

          <section className="checkout-section rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-lg bg-primary/12 text-primary"><Truck className="size-5" /></span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Delivery details</h2>
                <p className="text-sm text-muted-foreground">Used for delivery updates and order confirmation.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Full name
                <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Phone
                <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="076..." required />
              </label>
              <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                Delivery address
                <span className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-10" value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="Street, city" required />
                </span>
              </label>
            </div>
          </section>

          <section className="checkout-section rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-lg bg-primary/12 text-primary"><CreditCard className="size-5" /></span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Payment details</h2>
                <p className="text-sm text-muted-foreground">Enter card details to authorize this order securely.</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-border bg-background/45 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-muted-foreground">NOVA PAY</span>
                <LockKeyhole className="size-4 text-primary" />
              </div>
              <p className="mt-8 font-mono text-xl tracking-[0.18em]">{form.cardNumber}</p>
              <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{form.cardName || "CARD HOLDER"}</span>
                <span>{form.expiry}</span>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                Name on card
                <Input value={form.cardName} onChange={(event) => setForm((prev) => ({ ...prev, cardName: event.target.value }))} required />
              </label>
              <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                Card number
                <Input value={form.cardNumber} onChange={(event) => setForm((prev) => ({ ...prev, cardNumber: event.target.value }))} required />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Expiry
                <Input value={form.expiry} onChange={(event) => setForm((prev) => ({ ...prev, expiry: event.target.value }))} required />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                CVC
                <Input value={form.cvc} onChange={(event) => setForm((prev) => ({ ...prev, cvc: event.target.value }))} required />
              </label>
            </div>
          </section>

          {message ? <p className="rounded-md bg-warning/10 p-3 text-sm text-warning">{message}</p> : null}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)] lg:sticky lg:top-28">
          <h2 className="text-xl font-semibold tracking-tight">Order review</h2>
          <div className="mt-5 grid gap-3">
            {items.length === 0 ? (
              <p className="rounded-lg bg-muted/55 p-4 text-sm text-muted-foreground">Your cart is empty.</p>
            ) : null}
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3">
                <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  <Image src={getProductImage(item.products)} alt={item.products.name} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.products.name}</p>
                  <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                </div>
                <p className="font-mono text-sm font-semibold">{formatLkr(Number(item.products.price) * item.quantity)}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>{formatLkr(totalAmount)}</span></div>
            <div className="mt-2 flex justify-between text-sm text-muted-foreground"><span>Delivery</span><span>LKR 0</span></div>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-mono text-2xl font-semibold">{formatLkr(totalAmount)}</span>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-muted/55 p-3 text-xs text-muted-foreground">
            {paymentComplete ? <CheckCircle2 className="size-4 text-success" /> : <ShieldCheck className="size-4 text-primary" />}
            {processing ? paymentComplete ? "Payment authorized. Creating order..." : "Authorizing payment..." : "Encrypted checkout is active."}
          </div>
          <Button className="mt-5 w-full" disabled={processing || items.length === 0}>
            {processing ? "Processing payment..." : "Pay and place order"}
          </Button>
          <Link href="/cart"><Button type="button" variant="secondary" className="mt-3 w-full">Back to cart</Button></Link>
        </aside>
      </form>
    </AppShell>
  );
}
