"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, ImagePlus, PackagePlus, ShieldCheck } from "lucide-react";

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

const initialForm: ProductForm = {
  name: "",
  category: "Home",
  description: "",
  price: "",
  stock: "12",
};

export default function NewSellerProductPage() {
  const { token } = useAuth();
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [created, setCreated] = useState<Product | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof ProductForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      body.set("name", form.name);
      body.set("category", form.category);
      body.set("description", form.description);
      body.set("price", String(Number(form.price)));
      body.set("stock", String(Number(form.stock)));
      images.forEach((image) => body.append("images", image));
      const data = await api.upload<{ product: Product }>("/seller/products", body, token);
      setCreated(data.product);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Add seller product" eyebrow="Product review queue" icon={<PackagePlus className="size-4" />}>
        New seller products are checked by Sentra and sent to admin approval before they appear in the public store.
      </PageHeader>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        {created ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-6 shadow-[var(--shadow-soft)] lg:col-span-2">
            <CheckCircle2 className="size-8 text-primary" />
            <h2 className="mt-4 text-2xl font-semibold">Product sent for review</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Your product is now pending admin review. It will appear in the public catalog after approval.
            </p>
            <div className="mt-5 rounded-lg border border-border bg-card/70 p-4">
              <Badge tone="warn">{(created.approval_status || "pending_review").replaceAll("_", " ")}</Badge>
              <h3 className="mt-3 font-semibold">{created.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Sentra completed the automated pre-review and queued it for admin approval.</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/seller/products"><Button>Back to products</Button></Link>
              <Button variant="secondary" onClick={() => { setCreated(null); setForm(initialForm); setImages([]); }}>Add another product</Button>
            </div>
          </div>
        ) : (
        <form onSubmit={submit} className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <Link href="/seller/products" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to products</Link>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Product name
              <Input value={form.name} onChange={(event) => update("name", event.target.value)} required />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Category
              <Input value={form.category} onChange={(event) => update("category", event.target.value)} required />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Price in LKR
              <Input type="number" min="1" value={form.price} onChange={(event) => update("price", event.target.value)} required />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Stock
              <Input type="number" min="0" value={form.stock} onChange={(event) => update("stock", event.target.value)} required />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            Product images
            <div className="rounded-xl border border-dashed border-border bg-background/45 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <ImagePlus className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Upload up to 6 images</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP, or GIF. First image becomes the catalog cover.</p>
                </div>
              </div>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="mt-4"
                onChange={(event) => setImages(Array.from(event.target.files || []).slice(0, 6))}
              />
              {images.length ? (
                <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
                  {images.map((image, index) => (
                    <div key={`${image.name}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                      <Image src={URL.createObjectURL(image)} alt={image.name} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Description
            <Textarea value={form.description} onChange={(event) => update("description", event.target.value)} required placeholder="Mention materials, sizing, warranty, delivery notes, and what is included." />
          </label>
          {error ? <p className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={saving}>{saving ? "Sending for review..." : "Send product for review"}</Button>
        </form>
        )}

        <aside className="grid content-start gap-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">Sentra product screening</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Every listing receives a Sentra pre-review before it goes live. We look for signals that help keep the catalog trustworthy, consistent, and safe for customers.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">What happens next?</h2>
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
              <p>1. Upload the listing and product images.</p>
              <p>2. Sentra prepares the listing for admin review.</p>
              <p>3. Admin approves, rejects, or requests updates.</p>
              <p>4. Approved products appear in the public store.</p>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
