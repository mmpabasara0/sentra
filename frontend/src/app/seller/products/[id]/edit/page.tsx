"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ImagePlus, Save, ShieldCheck } from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import type { Product } from "@/lib/types";
import { api } from "@/services/api";

type ProductForm = {
  name: string;
  category: string;
  description: string;
  price: string;
  stock: string;
};

export default function EditSellerProductPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [form, setForm] = useState<ProductForm>({ name: "", category: "", description: "", price: "", stock: "" });
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !id) return;
    api.get<{ products: Product[] }>("/seller/products", token)
      .then((data) => {
        const found = data.products.find((item) => item.id === id || item.slug === id);
        if (!found) throw new Error("Product was not found.");
        setProduct(found);
        setForm({
          name: found.name,
          category: found.category,
          description: found.description,
          price: String(found.price),
          stock: String(found.stock),
        });
      })
      .catch((err) => setError((err as Error).message));
  }, [id, token]);

  function update(field: keyof ProductForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !id) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const body = new FormData();
      body.set("name", form.name);
      body.set("category", form.category);
      body.set("description", form.description);
      body.set("price", String(Number(form.price)));
      body.set("stock", String(Number(form.stock)));
      images.forEach((image) => body.append("images", image));
      const data = await api.uploadPut<{ product: Product }>(`/seller/products/${id}`, body, token);
      setProduct(data.product);
      setImages([]);
      setMessage("Changes were sent for product review.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title={product ? `Edit ${product.name}` : "Edit seller product"} eyebrow="Listing update">
        Product changes return to the approval queue so the public catalog stays clean.
      </PageHeader>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={submit} className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <Link href="/seller/products" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to products</Link>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">Product name<Input value={form.name} onChange={(event) => update("name", event.target.value)} required /></label>
            <label className="grid gap-2 text-sm font-semibold">Category<Input value={form.category} onChange={(event) => update("category", event.target.value)} required /></label>
            <label className="grid gap-2 text-sm font-semibold">Price in LKR<Input type="number" min="1" value={form.price} onChange={(event) => update("price", event.target.value)} required /></label>
            <label className="grid gap-2 text-sm font-semibold">Stock<Input type="number" min="0" value={form.stock} onChange={(event) => update("stock", event.target.value)} required /></label>
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            Product images
            <div className="rounded-xl border border-dashed border-border bg-background/45 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <ImagePlus className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Upload images only if you want to replace the current gallery</p>
                  <p className="text-xs text-muted-foreground">Up to 6 images. First image becomes the catalog cover.</p>
                </div>
              </div>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="mt-4"
                onChange={(event) => setImages(Array.from(event.target.files || []).slice(0, 6))}
              />
              <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
                {(images.length ? images.map((image) => URL.createObjectURL(image)) : product?.product_images?.length ? product.product_images : product?.image_url ? [product.image_url] : []).map((src, index) => (
                  <div key={`${src}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                    <Image src={src} alt={`${product?.name || "Product"} image ${index + 1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </label>
          <label className="grid gap-2 text-sm font-semibold">Description<Textarea value={form.description} onChange={(event) => update("description", event.target.value)} required /></label>
          {error ? <p className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
          {message ? <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{message}</p> : null}
          <Button type="submit" disabled={saving}><Save className="size-4" /> {saving ? "Saving..." : "Save and send for review"}</Button>
        </form>

        <aside className="grid content-start gap-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">Current review state</h2>
            {product ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={product.approval_status === "approved" ? "good" : product.approval_status === "rejected" ? "bad" : "warn"}>{(product.approval_status || "pending_review").replace("_", " ")}</Badge>
                <Badge tone="neutral">Sentra checked</Badge>
              </div>
            ) : <p className="mt-4 text-sm text-muted-foreground">Loading product...</p>}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Sentra screening</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Sentra prepares every edited listing for admin review before it goes public again. Internal scoring details are visible to admins in the review panel.
            </p>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
