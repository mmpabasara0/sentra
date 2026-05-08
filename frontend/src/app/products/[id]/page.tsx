"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, MessageCircle, Minus, Plus, Send, ShieldCheck, ShoppingCart, Star, Truck } from "lucide-react";

import { ReviewForm } from "@/components/customer/review-form";
import { getProductImage } from "@/components/customer/product-grid";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLkr } from "@/lib/currency";
import { demoProducts } from "@/lib/demo-data";
import type { Product, Review } from "@/lib/types";
import { api } from "@/services/api";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";

type ReviewComment = {
  id: string;
  body: string;
  status: string;
  risk_score: number;
  profiles?: { full_name?: string; username?: string };
};

function findDemoProduct(identifier: string) {
  return demoProducts.find((item) => item.id === identifier || item.slug === identifier);
}

function ReviewCommentThread({ review, productId }: { review: Review; productId: string }) {
  const { token } = useAuth();
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    api.get<{ comments: ReviewComment[] }>(`/reviews/${review.id}/comments`)
      .then((data) => setComments(data.comments))
      .catch(() => setComments([]));
  }, [open, review.id]);

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      setMessage("Sign in before commenting.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const data = await api.post<{ comment: ReviewComment; reasons: string[] }>(
        `/reviews/${review.id}/comments`,
        { product_id: productId, body },
        token,
      );
      setComments((current) => [data.comment, ...current]);
      setBody("");
      setMessage(data.comment.status === "published" ? "Comment published." : "Comment sent to moderation.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Comment failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <MessageCircle className="size-4" /> {open ? "Hide comments" : "View and add comments"}
      </button>
      {open ? (
        <div className="comment-panel mt-4 grid gap-3">
          <form onSubmit={submitComment} className="flex gap-2">
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Ask about delivery, fit, or product use"
              className="min-h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none ring-primary/25 focus:border-primary focus:ring-4"
              required
            />
            <Button disabled={loading || !body.trim()} className="px-3">
              <Send className="size-4" />
            </Button>
          </form>
          {message ? <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{message}</p> : null}
          {comments.map((comment) => (
            <div key={comment.id} className="comment-item rounded-lg bg-muted/55 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{comment.profiles?.username || "NovaMart customer"}</span>
                <Badge tone={comment.status === "published" ? "good" : "warn"}>{comment.status}</Badge>
              </div>
              <p className="mt-1 leading-6 text-muted-foreground">{comment.body}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ProductDetailPage() {
  const { id: identifier } = useParams<{ id: string }>();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(findDemoProduct(identifier) || demoProducts[0]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [persistedCatalogProduct, setPersistedCatalogProduct] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      try {
        const direct = await api.get<{ product: Product; reviews: Review[] }>(`/products/${identifier}`);
        setProduct(direct.product);
        setReviews(direct.reviews);
        setPersistedCatalogProduct(true);
        return;
      } catch {
        // Public storefront URLs use product slugs. Resolve the slug to the internal API id only when needed.
      }

      try {
        const catalog = await api.get<{ products: Product[] }>("/products");
        const matched = catalog.products.find((item) => item.slug === identifier || item.id === identifier);
        if (matched) {
          const detail = await api.get<{ product: Product; reviews: Review[] }>(`/products/${matched.id}`);
          setProduct(detail.product);
          setReviews(detail.reviews);
          setPersistedCatalogProduct(true);
          return;
        }
      } catch {
        // Fall back to local demo products when the backend is unavailable.
      }

      setProduct(findDemoProduct(identifier) || demoProducts[0]);
      setReviews([]);
      setPersistedCatalogProduct(false);
    }

    void loadProduct();
  }, [identifier]);

  const ratingBreakdown = useMemo(() => {
    const rating = product?.average_rating || 4.4;
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      width: stars === 5 ? rating * 18 : Math.max(8, (6 - stars) * 7),
    }));
  }, [product?.average_rating]);

  const productImages = useMemo(() => {
    if (!product) return [];
    const images = product.product_images?.length ? product.product_images : [getProductImage(product)];
    return Array.from(new Set(images.filter(Boolean)));
  }, [product]);

  async function handleAddToCart() {
    if (!product) {
      return;
    }
    setAdding(true);
    try {
      await addItem(product, quantity);
      setNotice(`${quantity} item${quantity > 1 ? "s" : ""} added to cart.`);
    } finally {
      window.setTimeout(() => setAdding(false), 420);
    }
  }

  if (!product) return null;

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to products
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4">
            <div className="reveal relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted shadow-[var(--shadow-soft)]">
              <Image src={productImages[0] || getProductImage(product)} alt={product.name} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {(productImages.length ? productImages.slice(0, 4) : [getProductImage(product)]).map((src, item) => (
                <div key={`${src}-${item}`} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-card/70">
                  <Image src={src} alt={`${product.name} view ${item + 1}`} fill className="object-cover opacity-90" />
                </div>
              ))}
            </div>
          </div>

          <div className="reveal grid content-start gap-5" style={{ "--delay": 1 } as React.CSSProperties}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{product.category}</Badge>
                <Badge tone="good">In stock</Badge>
              </div>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{product.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{product.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 border-y border-border py-4">
              <span className="font-mono text-4xl font-semibold">{formatLkr(product.price)}</span>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="size-4 fill-current text-warning" /> {Number(product.average_rating).toFixed(1)} rating
              </span>
              <span className="text-sm text-muted-foreground">{product.stock} available</span>
            </div>
            <div className="grid gap-3 rounded-xl border border-border bg-card/70 p-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Truck className="size-4 text-primary" />
                Delivery in 2-4 business days
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" />
                Secure checkout and order tracking
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-h-11 items-center rounded-md border border-border bg-card">
                <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid size-11 place-items-center hover:bg-muted">
                  <Minus className="size-4" />
                </button>
                <span className="w-12 text-center font-mono">{quantity}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} className="grid size-11 place-items-center hover:bg-muted">
                  <Plus className="size-4" />
                </button>
              </div>
              <Button onClick={handleAddToCart} disabled={!persistedCatalogProduct} className={adding ? "add-button-pop" : ""}>
                <ShoppingCart className="size-4" /> {!persistedCatalogProduct ? "Preparing purchase" : adding ? "Added" : "Add to cart"}
              </Button>
              <Button variant="secondary"><Heart className="size-4" /> Save</Button>
            </div>
            {notice ? <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{notice}</p> : null}
            <div className="rounded-xl border border-border bg-card/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Customer rating</h2>
                  <p className="text-sm text-muted-foreground">Based on published buyer reviews.</p>
                </div>
                <p className="font-mono text-3xl font-semibold">{Number(product.average_rating).toFixed(1)}</p>
              </div>
              <div className="mt-4 grid gap-2">
                {ratingBreakdown.map((item) => (
                  <div key={item.stars} className="grid grid-cols-[34px_1fr] items-center gap-3 text-xs text-muted-foreground">
                    <span>{item.stars} star</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.width)}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 lg:grid-cols-[0.9fr_1.1fr]">
        {persistedCatalogProduct ? (
          <ReviewForm productId={product.id} />
        ) : (
          <div className="rounded-xl border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-xl font-semibold tracking-tight">Storefront preview</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This item is part of the expanded catalog showcase. Reviews and checkout stay active on products currently synced with the live backend.
            </p>
          </div>
        )}
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Customer reviews</h2>
            <span className="text-sm text-muted-foreground">{reviews.length} published</span>
          </div>
          <div className="grid gap-4">
            {reviews.length === 0 ? (
              <p className="rounded-xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">
                No published reviews yet. Be the first buyer to share a product experience.
              </p>
            ) : null}
            {reviews.map((review) => (
              <article key={review.id} className="review-card rounded-xl border border-border bg-card/70 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="good">{review.rating} stars</Badge>
                  {review.is_verified_purchase ? <Badge>Verified purchase</Badge> : null}
                  <span className="text-sm text-muted-foreground">{review.profiles?.username || "NovaMart customer"}</span>
                </div>
                <h3 className="mt-3 font-semibold">{review.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{review.body}</p>
                <ReviewCommentThread review={review} productId={product.id} />
              </article>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
