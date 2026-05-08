import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, Package, ShieldCheck, ShoppingCart, Star, Truck } from "lucide-react";

import { ProductGrid } from "@/components/customer/product-grid";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLkr } from "@/lib/currency";
import { demoProducts } from "@/lib/demo-data";

const heroTiles = [
  { title: "Desk upgrades", image: "/products/lumadesk-lamp.svg", price: formatLkr(11990), slug: "lumadesk-lamp" },
  { title: "Audio deals", image: "/products/voltedge-earbuds.svg", price: formatLkr(21990), slug: "voltedge-earbuds" },
  { title: "Travel picks", image: "/products/aster-pack.svg", price: formatLkr(18990), slug: "aster-carry-pack" },
  { title: "Kitchen refresh", image: "/products/cinder-brew-kettle.svg", price: formatLkr(16990), slug: "cinder-brew-kettle" },
];

const shopHighlights = [
  { icon: Truck, title: "Fast delivery", copy: "City orders arrive in 2-4 business days." },
  { icon: ShieldCheck, title: "Protected checkout", copy: "Secure account sessions and order history." },
  { icon: BadgeCheck, title: "Review quality", copy: "Reviews stay useful, specific, and fair." },
];

export default function Home() {
  const trendingProducts = demoProducts.slice(0, 8);
  const newArrivals = demoProducts.slice(8, 16);

  return (
    <AppShell>
      <section className="overflow-hidden border-b border-border bg-card/35">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
          <div className="reveal">
            <Badge tone="good">Weekend market picks</Badge>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
              Smart everyday gear without the endless scrolling.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
              Shop curated tech, home, fitness, kitchen, and travel essentials from trusted NovaMart sellers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products">
                <Button><ShoppingCart className="size-4" /> Shop the catalog</Button>
              </Link>
              <Link href="/products">
                <Button variant="secondary">View today&apos;s deals <ArrowRight className="size-4" /></Button>
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["4.6", "average rating"],
                ["2-4d", "delivery window"],
                ["24/7", "order tracking"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border border-border bg-card/65 p-4">
                  <p className="font-mono text-2xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="reveal relative min-h-[520px]" style={{ "--delay": 1 } as React.CSSProperties}>
            <div className="absolute right-0 top-0 hidden h-44 w-44 rounded-full border border-border bg-muted/50 md:block" />
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="float-soft overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] sm:row-span-2">
                <div className="relative aspect-[4/5]">
                  <Image src="/products/home-market-hero.svg" alt="NovaMart home shopping collection" fill priority className="object-cover" />
                </div>
                <div className="p-5">
                  <p className="text-sm font-semibold">Daily setup bundle</p>
                  <p className="mt-1 text-sm text-muted-foreground">Lamp, audio, bottle, and carry gear.</p>
                </div>
              </article>
              {heroTiles.map((tile, index) => (
                <Link
                  key={tile.title}
                  href={`/products/${tile.slug}`}
                  className="group overflow-hidden rounded-xl border border-border bg-card/82 p-4 shadow-[var(--shadow-soft)] hover:-translate-y-1"
                  style={{ "--delay": index + 2 } as React.CSSProperties}
                >
                  <div className="relative aspect-[5/4] overflow-hidden rounded-lg bg-muted">
                    <Image src={tile.image} alt={tile.title} fill className="object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{tile.title}</p>
                    <p className="font-mono text-sm text-primary">{tile.price}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-3 px-4 py-6 md:grid-cols-3">
        {shopHighlights.map((item, index) => (
          <article key={item.title} className="reveal flex items-center gap-4 rounded-lg border border-border bg-card/55 p-4" style={{ "--delay": index } as React.CSSProperties}>
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/12 text-primary">
              <item.icon className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.copy}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 overflow-hidden rounded-xl border border-border bg-card/70 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><Clock3 className="size-4" /> Flash sale window</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Save on work, travel, and fitness essentials</h2>
          </div>
          <div className="flex gap-2 font-mono text-sm">
            {["08h", "42m", "16s"].map((item) => (
              <span key={item} className="rounded-md bg-muted px-3 py-2">{item}</span>
            ))}
          </div>
        </div>
      </section>

      <ProductGrid title="Trending now" subtitle="Fast-moving picks shoppers are opening right now." products={trendingProducts} showControls={false} limit={8} />

      <section className="mx-auto max-w-7xl px-4 pb-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Just landed</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">New arrivals</h2>
          </div>
          <Link href="/products">
            <Button variant="secondary">See the full store <ArrowRight className="size-4" /></Button>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {newArrivals.slice(0, 4).map((product, index) => (
            <Link
              key={product.id}
              href={`/products/${product.slug || product.id}`}
              className="reveal rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)] hover:-translate-y-1"
              style={{ "--delay": index } as React.CSSProperties}
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                <Image src={product.image_url} alt={product.name} fill className="object-cover" />
              </div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{product.category}</p>
                </div>
                <p className="font-mono text-sm text-primary">{formatLkr(product.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProductGrid title="Recommended for you" subtitle="Popular products from active NovaMart sellers." products={demoProducts} showControls={false} limit={8} />

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-xl border border-border bg-card/70 p-6">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><Package className="size-4" /> Buyer confidence</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Real orders, clear histories, better reviews.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            NovaMart keeps review pages useful by showing purchase context and clean product activity where shoppers need it most.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {["Verified purchases", "Seller ratings", "Helpful review history"].map((item, index) => (
            <div key={item} className="reveal rounded-xl border border-border bg-card/70 p-5" style={{ "--delay": index } as React.CSSProperties}>
              <Star className="size-5 fill-current text-primary" />
              <p className="mt-4 font-semibold">{item}</p>
              <p className="mt-2 text-sm text-muted-foreground">Visible signals that make product decisions easier.</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
