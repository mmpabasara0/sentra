"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Mail, RefreshCcw, UserRound, AtSign, Lock, Check } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PENDING_PROFILE_KEY, useAuth } from "@/context/auth-context";
import { api } from "@/services/api";
import { supabase } from "@/services/supabase";
import { cn } from "@/lib/utils";

type InboxShortcut = {
  label: string;
  url: string;
};

type EmailStatus = {
  exists: boolean;
  verified: boolean;
  status: "not_found" | "unverified" | "verified";
  message: string;
};

async function getEmailStatus(email: string) {
  return api.post<EmailStatus>("/auth/email-status", { email });
}

function getInboxShortcuts(email: string): InboxShortcut[] {
  const domain = email.split("@")[1]?.toLowerCase() || "";

  if (domain.includes("gmail")) {
    return [
      { label: "Open Gmail", url: "https://mail.google.com/" }
    ];
  }

  if (/(outlook|hotmail|live|msn)\./.test(domain)) {
    return [
      { label: "Open Outlook", url: "https://outlook.live.com/mail/" }
    ];
  }

  if (domain.includes("yahoo")) {
    return [
      { label: "Open Yahoo Mail", url: "https://mail.yahoo.com/" }
    ];
  }

  return [
    { label: "Back to sign in", url: "/login" },
  ];
}

export default function RegisterPage() {
  const router = useRouter();
  const { signIn, signUp, session } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", fullName: "", username: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [verifiedButSignedOut, setVerifiedButSignedOut] = useState(false);
  const [autoContinuing, setAutoContinuing] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const pwd = form.password;
  const hasMinLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber;

  useEffect(() => {
    if (awaitingVerification && session) {
      router.push("/");
    }
  }, [awaitingVerification, router, session]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setVerifiedButSignedOut(false);
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      const status = await getEmailStatus(email);
      setEmailStatus(status);

      if (status.status === "verified") {
        setError("An account with this email is already verified. Sign in instead of registering again.");
        return;
      }

      if (status.status === "unverified") {
        window.localStorage.setItem(
          PENDING_PROFILE_KEY,
          JSON.stringify({ full_name: form.fullName, username: form.username }),
        );
        setPendingEmail(email);
        setAwaitingVerification(true);
        setNotice("This account already exists but is not verified yet. We sent another verification email if one can be sent right now.");
        await resendVerificationEmail(email);
        return;
      }

      const result = await signUp(email, form.password, form.fullName, form.username);
      if (result.confirmationRequired) {
        setPendingEmail(email);
        setEmailStatus({ exists: true, verified: false, status: "unverified", message: "Verification email sent." });
        setAwaitingVerification(true);
        setNotice("Verification email sent. Keep this screen open — we will continue automatically once your email is verified.");
        return;
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerificationEmail(email = pendingEmail) {
    if (!supabase) {
      setError("Email verification is not configured.");
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      setError("Enter your email address first.");
      return;
    }

    setResending(true);
    setError("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: `${window.location.origin}/register` },
      });
      if (resendError) throw resendError;
      setPendingEmail(targetEmail);
      setEmailStatus({ exists: true, verified: false, status: "unverified", message: "Verification email sent." });
      setNotice("Verification email sent again. Keep this screen open — we will continue automatically once your email is verified.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not resend the verification email.");
    } finally {
      setResending(false);
    }
  }

  const checkVerification = useCallback(async (automatic = false) => {
    if (!automatic) setChecking(true);
    if (automatic) setAutoContinuing(true);
    setError("");
    setVerifiedButSignedOut(false);
    try {
      const targetEmail = pendingEmail.trim().toLowerCase();
      if (!targetEmail) {
        throw new Error("We do not know which email to check. Please register again.");
      }

      const status = await getEmailStatus(targetEmail);
      setEmailStatus(status);

      if (status.status === "not_found") {
        setNotice("");
        throw new Error("No NovaMart account exists for this email. Create the account again.");
      }

      if (!status.verified) {
        if (!automatic) {
          setNotice("We are still waiting for confirmation. Open the latest verification email, then this page will continue automatically.");
        }
        return;
      }

      setNotice("We verified your email. Signing you in...");

      if (form.password) {
        await signIn(targetEmail, form.password);
        router.push("/");
        return;
      }

      setVerifiedButSignedOut(true);
      setNotice("We verified your email. Sign in to continue to NovaMart.");
    } catch (err) {
      if (!automatic) {
        setError(err instanceof Error ? err.message : "We could not verify your account yet.");
      }
    } finally {
      if (!automatic) setChecking(false);
      if (automatic) setAutoContinuing(false);
    }
  }, [form.password, pendingEmail, router, signIn]);

  useEffect(() => {
    if (!awaitingVerification || !pendingEmail || verifiedButSignedOut || session) return;

    const firstCheck = window.setTimeout(() => {
      void checkVerification(true);
    }, 1200);

    const interval = window.setInterval(() => {
      void checkVerification(true);
    }, 4500);

    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(interval);
    };
  }, [awaitingVerification, checkVerification, pendingEmail, session, verifiedButSignedOut]);

  if (awaitingVerification) {
    const shortcuts = getInboxShortcuts(pendingEmail);
    const statusLabel = emailStatus?.status === "verified"
      ? "Email verified"
      : emailStatus?.status === "not_found"
        ? "Account not found"
        : "Waiting for email confirmation";

    return (
      <AppShell>
        <section className="mx-auto grid min-h-[72dvh] max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="reveal hidden overflow-hidden rounded-xl border border-border bg-card/70 shadow-[var(--shadow-soft)] lg:block">
            <div className="grid grid-cols-2 gap-3 p-4">
              {["/products/aster-pack.svg", "/products/voltedge-earbuds.svg", "/products/lumadesk-lamp.svg", "/products/nova-charge-dock.svg"].map((src) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  <Image src={src} alt="NovaMart product" fill className="object-cover" />
                </div>
              ))}
            </div>
            <div className="p-6 pt-2">
              <h2 className="text-3xl font-semibold tracking-tight">One last step and you are in.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">As soon as your email is verified, we can move you straight into the storefront.</p>
            </div>
          </div>

          <div className="reveal mx-auto grid w-full max-w-md gap-5 rounded-xl border border-border bg-card/78 p-6 shadow-[var(--shadow-soft)]">
            <div className={cn(
              "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold",
              emailStatus?.status === "verified" ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
            )}>
              {emailStatus?.status === "verified" ? <CheckCircle2 className="size-4" /> : <Mail className="size-4" />}
              {statusLabel}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Check your inbox</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                We sent a confirmation link to <span className="font-semibold text-foreground">{pendingEmail}</span>.
              </p>
            </div>

            {notice ? (
              <p className="rounded-md bg-success/10 p-3 text-sm text-success">{notice}</p>
            ) : null}
            {error ? (
              <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>
            ) : null}

            <div className="grid gap-3">
              {shortcuts.map((shortcut) =>
                shortcut.url.startsWith("/") ? (
                  <Link key={shortcut.label} href={shortcut.url}>
                    <Button variant="secondary" className="w-full">
                      {shortcut.label}
                    </Button>
                  </Link>
                ) : (
                  <a key={shortcut.label} href={shortcut.url} target={shortcut.url === "mailto:" ? undefined : "_blank"} rel="noreferrer">
                    <Button variant="secondary" className="w-full">
                      {shortcut.label} <ExternalLink className="size-4" />
                    </Button>
                  </a>
                ),
              )}
            </div>

            <Button onClick={() => checkVerification(false)} disabled={checking || autoContinuing}>
              <RefreshCcw className="size-4" />
              {checking || autoContinuing ? "Checking automatically..." : "Check verification now"}
            </Button>

            <Button type="button" variant="secondary" onClick={() => resendVerificationEmail()} disabled={resending || checking}>
              <Mail className="size-4" />
              {resending ? "Sending email..." : "Resend verification email"}
            </Button>

            {(verifiedButSignedOut || emailStatus?.status === "verified") ? (
              <Link href="/login">
                <Button className="w-full">
                  Sign in and continue
                </Button>
              </Link>
            ) : null}

            <p className="text-sm text-muted-foreground">
              Keep this screen open after confirming your email. We will detect it automatically and continue for you.
            </p>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mx-auto grid min-h-[72dvh] max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <form onSubmit={submit} className="reveal mx-auto grid w-full max-w-md gap-5 rounded-xl border border-border bg-card/78 p-6 shadow-[var(--shadow-soft)]">
          <div>
            <p className="text-sm font-semibold text-primary">Start shopping</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your NovaMart account</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep carts, orders, and product reviews attached to your profile.</p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Full name
            <span className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="John Doe" required />
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Username
            <span className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="johndoe" required minLength={3} />
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Email
            <span className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="johndoe@example.com" required />
            </span>
          </label>
          <div className="grid gap-2 text-sm font-medium">
            <label htmlFor="password-input">Password</label>
            <span className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                id="password-input"
                className="pl-10" 
                type="password" 
                value={form.password} 
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="••••••••"
                required 
                minLength={8} 
              />
            </span>
            <div
              className={cn(
                "grid transition-all duration-300 ease-out",
                passwordFocused || pwd.length > 0 ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="mt-1 rounded-md border border-border bg-card/40 p-3 text-xs text-muted-foreground">
                  <p className="mb-2 font-semibold text-foreground">Password requirements:</p>
                  <ul className="grid gap-1.5">
                    <li className={cn("flex items-center gap-2 transition-colors", hasMinLength ? "text-success" : "")}>
                      {hasMinLength ? <Check className="size-3.5" /> : <span className="ml-[5px] mr-[5px] size-1.5 rounded-full bg-muted-foreground/50" />}
                      At least 8 characters
                    </li>
                    <li className={cn("flex items-center gap-2 transition-colors", hasUpper ? "text-success" : "")}>
                      {hasUpper ? <Check className="size-3.5" /> : <span className="ml-[5px] mr-[5px] size-1.5 rounded-full bg-muted-foreground/50" />}
                      An uppercase letter
                    </li>
                    <li className={cn("flex items-center gap-2 transition-colors", hasLower ? "text-success" : "")}>
                      {hasLower ? <Check className="size-3.5" /> : <span className="ml-[5px] mr-[5px] size-1.5 rounded-full bg-muted-foreground/50" />}
                      A lowercase letter
                    </li>
                    <li className={cn("flex items-center gap-2 transition-colors", hasNumber ? "text-success" : "")}>
                      {hasNumber ? <Check className="size-3.5" /> : <span className="ml-[5px] mr-[5px] size-1.5 rounded-full bg-muted-foreground/50" />}
                      A number
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          {error ? <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
          {notice ? (
            <p className="flex gap-2 rounded-md bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              {notice}
            </p>
          ) : null}
          <Button disabled={loading || !isPasswordValid}>{loading ? "Creating account..." : "Create account"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link className="font-semibold text-primary hover:underline" href="/login">Sign in</Link>
          </p>
        </form>
        <div className="reveal hidden overflow-hidden rounded-xl border border-border bg-card/70 shadow-[var(--shadow-soft)] lg:block" style={{ "--delay": 1 } as React.CSSProperties}>
          <div className="grid grid-cols-2 gap-3 p-4">
            {["/products/aster-pack.svg", "/products/voltedge-earbuds.svg", "/products/lumadesk-lamp.svg", "/products/forma-bottle.svg"].map((src) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <Image src={src} alt="NovaMart product" fill className="object-cover" />
              </div>
            ))}
          </div>
          <div className="p-6 pt-2">
            <h2 className="text-3xl font-semibold tracking-tight">Deals, orders, and reviews in one place.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">A clean account gives you faster checkout and better product history.</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
