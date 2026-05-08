"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LockKeyhole, Mail, ShoppingBag } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/products");
    } catch (err) {
      const message = err instanceof Error ? err.message : "We could not sign you in. Please check your details.";
      setError(
        /email not confirmed/i.test(message)
          ? "Your account exists, but the email is not verified yet. Go back to registration and resend the verification email."
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto grid min-h-[72dvh] max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="reveal hidden overflow-hidden rounded-xl border border-border bg-card/70 shadow-[var(--shadow-soft)] lg:block">
          <div className="relative aspect-[5/4]">
            <Image src="/products/home-market-hero.svg" alt="NovaMart shopping collection" fill priority className="object-cover" />
          </div>
          <div className="grid gap-3 p-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/12 px-3 py-1 text-sm font-semibold text-primary">
              <ShoppingBag className="size-4" /> NovaMart account
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Pick up where you left off.</h1>
            <p className="text-sm leading-6 text-muted-foreground">Open your cart, view orders, and keep your review history connected to real purchases.</p>
          </div>
        </div>
        <form onSubmit={submit} className="reveal mx-auto grid w-full max-w-md gap-5 rounded-xl border border-border bg-card/78 p-6 shadow-[var(--shadow-soft)]" style={{ "--delay": 1 } as React.CSSProperties}>
          <div>
            <p className="text-sm font-semibold text-primary">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to NovaMart</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Use the email and password you registered with.</p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Email
            <span className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Password
            <span className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" type="password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </span>
          </label>
          {error ? <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
          <Button disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            New to NovaMart? <Link className="font-semibold text-primary hover:underline" href="/register">Create an account</Link>
          </p>
        </form>
      </section>
    </AppShell>
  );
}
