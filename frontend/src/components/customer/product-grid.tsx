"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, PackageCheck, Search, ShoppingCart, SlidersHorizontal, Star, Truck, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLkr } from "@/lib/currency";
import { demoProducts } from "@/lib/demo-data";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useCart } from "@/context/cart-context";

const productImages: Record<string, string> = {
  "Arc Mouse Pad": "/products/arc-mouse-pad.svg",
  "Aster Carry Pack": "/products/aster-pack.svg",
  "Atlas Travel Thermos": "/products/atlas-travel-thermos.svg",
  "Cinder Brew Kettle": "/products/cinder-brew-kettle.svg",
  "Cove Sling Bag": "/products/cove-sling-bag.svg",
  "Drift Sound Speaker": "/products/drift-sound-speaker.svg",
  "Forma Training Bottle": "/products/forma-bottle.svg",
  "Halo Desk Fan": "/products/halo-desk-fan.svg",
  "Lattice Wall Shelf": "/products/lattice-wall-shelf.svg",
  "LumaDesk Lamp": "/products/lumadesk-lamp.svg",
  "Mira Ceramic Mug": "/products/mira-mug.svg",
  "Nori Storage Box": "/products/nori-storage-box.svg",
  "Nova Charge Dock": "/products/nova-charge-dock.svg",
  "Pixel Note Stand": "/products/pixel-note-stand.svg",
  "Pulse Yoga Mat": "/products/pulse-yoga-mat.svg",
  "Quill Pen Cup": "/products/quill-pen-cup.svg",
  "Ridge Lunch Box": "/products/ridge-lunch-box.svg",
  "Solace Table Lamp": "/products/solace-table-lamp.svg",
  "Stride Recovery Roller": "/products/stride-recovery-roller.svg",
  "VoltEdge Earbuds": "/products/voltedge-earbuds.svg",
};

type ProductGridProps = {
  title?: string;
  subtitle?: string;
  products?: Product[];
  showControls?: boolean;
  limit?: number;
  initialQuery?: string;
  initialFiltersOpen?: boolean;
};

type SortMode = "featured" | "price-low" | "price-high" | "rating";
type PriceBand = "all" | "under-5000" | "5000-10000" | "10000-15000" | "15000-plus";

export function getProductImage(product: Product) {
  return productImages[product.name] || product.product_images?.[0] || product.image_url || "/products/home-market-hero.svg";
}

export function getProductPath(product: Product) {
  return `/products/${product.slug || product.id}`;
}

function mergeProducts(apiProducts: Product[]) {
  const merged = new Map<string, Product>();

  for (const product of demoProducts) {
    merged.set(product.slug || product.id, product);
  }

  for (const product of apiProducts) {
    const key = product.slug || product.id || product.name.toLowerCase();
    const fallback = merged.get(key);
    merged.set(key, {
      ...fallback,
      ...product,
      image_url: productImages[product.name] || product.product_images?.[0] || product.image_url || fallback?.image_url || "/products/home-market-hero.svg",
    });
  }

  return Array.from(merged.values());
}

function productMeta(product: Product, index: number) {
  const price = Number(product.price);
  const discount = [18, 12, 22, 9, 15, 11, 17, 14][index % 8];
  const oldPrice = price / (1 - discount / 100);
  return {
    discount,
    oldPrice,
    sold: [146, 82, 213, 67, 121, 189, 95, 154][index % 8],
    delivery: index % 3 === 0 ? "Free delivery" : index % 3 === 1 ? "Ships tomorrow" : "Store pickup available",
  };
}

function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/70">
      <div className="aspect-[4/3] bg-muted shimmer" />
      <div className="grid gap-3 p-4">
        <div className="h-4 w-24 rounded bg-muted shimmer" />
        <div className="h-6 w-3/4 rounded bg-muted shimmer" />
        <div className="h-4 w-full rounded bg-muted shimmer" />
        <div className="h-11 rounded bg-muted shimmer" />
      </div>
    </div>
  );
}

function matchesPriceBand(product: Product, band: PriceBand) {
  const price = Number(product.price);
  if (band === "under-5000") return price < 5000;
  if (band === "5000-10000") return price >= 5000 && price < 10000;
  if (band === "10000-15000") return price >= 10000 && price < 15000;
  if (band === "15000-plus") return price >= 15000;
  return true;
}

export function ProductGrid({
  title = "Product catalog",
  subtitle = "Fresh picks across NovaMart categories.",
  products,
  showControls = true,
  limit,
  initialQuery = "",
  initialFiltersOpen = false,
}: ProductGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { addItem } = useCart();
  const [addingProductId, setAddingProductId] = useState("");

  const [catalogProducts, setCatalogProducts] = useState<Product[]>(demoProducts);
  const [loading, setLoading] = useState(!products);
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSeller, setActiveSeller] = useState("All sellers");
  const [priceBand, setPriceBand] = useState<PriceBand>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);
  const deferredQuery = useDeferredValue(query);
  const sourceProducts = products ?? catalogProducts;

  useEffect(() => {
    if (products) return;

    api.get<{ products: Product[] }>("/products")
      .then((data) => setCatalogProducts(mergeProducts(data.products)))
      .catch(() => setCatalogProducts(demoProducts))
      .finally(() => setLoading(false));
  }, [products]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(sourceProducts.map((product) => product.category)))],
    [sourceProducts],
  );
  const sellers = useMemo(
    () => ["All sellers", ...Array.from(new Set(sourceProducts.map((product) => product.seller_name)))],
    [sourceProducts],
  );

  const visibleProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    let nextProducts = sourceProducts.filter((product) => {
      const queryMatch =
        !normalizedQuery ||
        [product.name, product.description, product.category, product.seller_name]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const categoryMatch = activeCategory === "All" || product.category === activeCategory;
      const sellerMatch = activeSeller === "All sellers" || product.seller_name === activeSeller;
      const priceMatch = matchesPriceBand(product, priceBand);
      return queryMatch && categoryMatch && sellerMatch && priceMatch;
    });

    if (sortMode === "price-low") {
      nextProducts = [...nextProducts].sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortMode === "price-high") {
      nextProducts = [...nextProducts].sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortMode === "rating") {
      nextProducts = [...nextProducts].sort((a, b) => Number(b.average_rating) - Number(a.average_rating));
    }

    if (limit) {
      return nextProducts.slice(0, limit);
    }

    return nextProducts;
  }, [activeCategory, activeSeller, deferredQuery, limit, priceBand, sortMode, sourceProducts]);

  function updateSearchRoute(nextQuery: string, openFilters = filtersOpen) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (openFilters) params.set("filters", "1");
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    updateSearchRoute(query);
  }

  function clearFilters() {
    setActiveCategory("All");
    setActiveSeller("All sellers");
    setPriceBand("all");
    setSortMode("featured");
    setQuery("");
    setFiltersOpen(false);
    router.replace(pathname, { scroll: false });
  }

  async function quickAdd(product: Product) {
    setAddingProductId(product.id);
    try {
      await addItem(product, 1);
    } finally {
      window.setTimeout(() => setAddingProductId(""), 420);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">{showControls ? "Browse the full store" : "Shop by interest"}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </div>
        {showControls ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => {
              const nextOpen = !filtersOpen;
              setFiltersOpen(nextOpen);
              updateSearchRoute(query, nextOpen);
            }}>
              <SlidersHorizontal className="size-4" /> {filtersOpen ? "Hide filters" : "Show filters"}
            </Button>
            <span className="rounded-full border border-border bg-card/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
              {visibleProducts.length} items
            </span>
          </div>
        ) : null}
      </div>

      {showControls ? (
        <div className="mb-6 grid gap-4 rounded-xl border border-border bg-card/70 p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 lg:flex-row">
            <form onSubmit={handleSearchSubmit} className="flex min-w-0 flex-1 items-center rounded-lg border border-border bg-background/50 px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                aria-label="Search catalog"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, category, or seller"
                className="min-h-11 flex-1 border-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => {
                  setQuery("");
                  updateSearchRoute("", filtersOpen);
                }} className="grid size-8 place-items-center rounded-md hover:bg-muted">
                  <X className="size-4" />
                </button>
              ) : null}
            </form>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[360px]">
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="min-h-11 rounded-lg border border-border bg-background/50 px-3 text-sm outline-none ring-primary/25 focus:border-primary focus:ring-4"
              >
                <option value="featured">Sort: Featured</option>
                <option value="price-low">Price: Low to high</option>
                <option value="price-high">Price: High to low</option>
                <option value="rating">Top rated</option>
              </select>
              <select
                value={priceBand}
                onChange={(event) => setPriceBand(event.target.value as PriceBand)}
                className="min-h-11 rounded-lg border border-border bg-background/50 px-3 text-sm outline-none ring-primary/25 focus:border-primary focus:ring-4"
              >
                <option value="all">All price ranges</option>
                <option value="under-5000">Under LKR 5,000</option>
                <option value="5000-10000">LKR 5,000 - 10,000</option>
                <option value="10000-15000">LKR 10,000 - 15,000</option>
                <option value="15000-plus">Above LKR 15,000</option>
              </select>
            </div>
          </div>
          {filtersOpen ? (
            <div className="grid gap-4 border-t border-border pt-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Categories</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={cn(
                        "rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground",
                        activeCategory === category && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Seller</p>
                <select
                  value={activeSeller}
                  onChange={(event) => setActiveSeller(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-border bg-background/50 px-3 text-sm outline-none ring-primary/25 focus:border-primary focus:ring-4"
                >
                  {sellers.map((seller) => (
                    <option key={seller} value={seller}>{seller}</option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <button type="button" onClick={clearFilters} className="text-sm font-semibold text-primary hover:underline">
                  Reset search and filters
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!showControls ? (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.slice(0, 8).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={cn(
                "whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground",
                activeCategory === category && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: limit || 8 }).map((_, index) => <ProductSkeleton key={index} />)}
        </div>
      ) : null}

      {!loading && visibleProducts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/70 p-8 text-center">
          <h3 className="text-xl font-semibold">No products found</h3>
          <p className="mt-2 text-sm text-muted-foreground">Try a different search, price range, or category.</p>
        </div>
      ) : null}

      {!loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {visibleProducts.map((product, index) => {
            const meta = productMeta(product, index);
            return (
              <article
                key={product.slug || product.id}
                className="reveal group overflow-hidden rounded-xl border border-border bg-card/75 shadow-[var(--shadow-soft)] hover:-translate-y-1"
                style={{ "--delay": index % 4 } as React.CSSProperties}
              >
                <Link href={getProductPath(product)} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <Image
                      src={getProductImage(product)}
                      alt={product.name}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    />
                    <span className="absolute left-3 top-3 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                      {meta.discount}% off
                    </span>
                    <button
                      type="button"
                      aria-label={`Save ${product.name}`}
                      className="absolute right-3 top-3 grid size-9 place-items-center rounded-md bg-background/78 text-foreground backdrop-blur hover:bg-card"
                    >
                      <Heart className="size-4" />
                    </button>
                  </div>
                </Link>
                <div className="grid gap-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge>{product.category}</Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <Star className="size-3.5 fill-current text-warning" /> {Number(product.average_rating).toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <Link href={getProductPath(product)} className="line-clamp-1 text-base font-semibold hover:text-primary">
                      {product.name}
                    </Link>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{product.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Sold by {product.seller_name}</p>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="font-mono text-xl font-semibold">{formatLkr(product.price)}</p>
                      <p className="font-mono text-xs text-muted-foreground line-through">{formatLkr(meta.oldPrice)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{meta.sold} sold</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Truck className="size-3.5" />
                    {meta.delivery}
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Link href={getProductPath(product)}>
                      <Button variant="secondary" className="w-full">
                        <PackageCheck className="size-4" /> View
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      aria-label={`Add ${product.name} to cart`}
                      onClick={() => void quickAdd(product)}
                      disabled={loading}
                      className={cn("px-3", addingProductId === product.id && "add-button-pop")}
                    >
                      {addingProductId === product.id ? <PackageCheck className="size-4" /> : <ShoppingCart className="size-4" />}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
