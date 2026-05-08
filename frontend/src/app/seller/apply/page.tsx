"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, Clock3, FileCheck2, ShieldCheck, Store, UploadCloud } from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import type { RiskReason, Seller, SellerApplication } from "@/lib/types";
import { api } from "@/services/api";

type SellerDocumentType = "nic" | "utility_bill" | "business_registration";

type FormState = {
  application_type: "personal" | "business";
  business_or_personal_name: string;
  email: string;
  phone: string;
  store_name: string;
  address: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  payment_notes: string;
};

const emptyForm: FormState = {
  application_type: "personal",
  business_or_personal_name: "",
  email: "",
  phone: "",
  store_name: "",
  address: "",
  bank_name: "",
  account_holder: "",
  account_number: "",
  payment_notes: "",
};

function reasonTone(score: number) {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

/** Shorten long file names for the upload cards (full name still in title tooltip). */
function shortFileName(name: string, max = 32) {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  if (dot > 0) {
    const base = name.slice(0, dot);
    const ext = name.slice(dot);
    if (ext.length + 5 <= max) {
      const headLen = max - ext.length - 1;
      return base.slice(0, Math.max(4, headLen)) + "…" + ext;
    }
  }
  return name.slice(0, max - 1) + "…";
}

function statusLabel(status?: SellerApplication["status"]) {
  return (status || "pending").replaceAll("_", " ");
}

function statusTone(status?: SellerApplication["status"]) {
  if (status === "approved") return "good";
  if (status === "rejected") return "bad";
  return "warn";
}

function formatDate(value?: string) {
  if (!value) return "Not submitted yet";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const DOC_CHECKLIST = [
  ["nic", "NIC document", "Required"],
  ["utility_bill", "Utility bill", "Required"],
  ["business_registration", "Business registration", "Optional"],
] as Array<[SellerDocumentType, string, string]>;

function DocumentChecklist({
  application,
  uploadedTypes,
}: {
  application: SellerApplication | null;
  uploadedTypes: Set<SellerDocumentType>;
}) {
  return (
    <div className="grid gap-2">
      {DOC_CHECKLIST.map(([key, label, helper]) => {
        const document = (application?.seller_documents || []).find((item) => item.document_type === key);
        const isUploaded = uploadedTypes.has(key);
        return (
          <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">
                {document ? `${document.verification_status} · ${shortFileName(document.original_name, 28)}` : helper}
              </p>
            </div>
            <Badge tone={isUploaded ? "good" : key === "business_registration" ? "warn" : "bad"}>
              {isUploaded ? "Uploaded" : key === "business_registration" ? "Optional" : "Missing"}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export default function SellerApplyPage() {
  const { session, profile, token, refreshProfile } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [application, setApplication] = useState<SellerApplication | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [files, setFiles] = useState<Record<SellerDocumentType, File | null>>({ nic: null, utility_bill: null, business_registration: null });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      setForm((current) => ({
        ...current,
        business_or_personal_name: current.business_or_personal_name || profile?.full_name || session.user.user_metadata?.full_name || "",
        email: current.email || profile?.email || session.user.email || "",
        phone: current.phone || profile?.phone || "",
        address: current.address || profile?.address || "",
        account_holder: current.account_holder || profile?.full_name || session.user.user_metadata?.full_name || "",
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile, session]);

  useEffect(() => {
    if (!token) return;
    api.get<{ application: SellerApplication | null; seller: Seller | null }>("/seller/application", token)
      .then((data) => {
        setApplication(data.application);
        setSeller(data.seller);
        if (data.application) {
          setForm((current) => ({ ...current, ...data.application }));
        }
      })
      .catch(() => undefined);
  }, [token]);

  const uploadedTypes = useMemo(
    () => new Set((application?.seller_documents || []).map((document) => document.document_type)),
    [application],
  );
  const isApprovedSeller = application?.status === "approved" && seller?.status === "active";
  const isPending = application?.status === "pending";
  const canResubmit = !application || application.status === "changes_requested" || application.status === "rejected" || application.status === "draft";

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    setStatus("Submitting seller verification...");
    try {
      const created = await api.post<{ application: SellerApplication; analysis: { reasons: RiskReason[] } }>(
        "/seller/apply",
        {
          ...form,
          account_number_last4: form.account_number.replace(/\D/g, "").slice(-4),
        },
        token,
      );
      let nextApplication = created.application;

      for (const [document_type, file] of Object.entries(files)) {
        if (!file) continue;
        const payload = new FormData();
        payload.append("document_type", document_type);
        payload.append("file", file);
        const uploaded = await api.upload<{ application?: SellerApplication; analysis?: unknown }>("/seller/documents", payload, token);
        if (uploaded.application) nextApplication = uploaded.application;
      }

      const refreshed = await api.get<{ application: SellerApplication | null; seller: Seller | null }>("/seller/application", token);
      setApplication(refreshed.application || nextApplication);
      setSeller(refreshed.seller);
      await refreshProfile();
      setStatus("Application sent for verification.");
    } catch (err) {
      setError((err as Error).message || "Could not submit seller application.");
      setStatus("");
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return (
      <AppShell>
        <PageHeader title="Open your NovaMart seller store" eyebrow="Seller verification" icon={<Store className="size-4" />}>
          Sign in or create an account first. We will bring you back here to complete store verification.
        </PageHeader>
        <section className="mx-auto grid max-w-3xl gap-4 px-4 py-12">
          <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-2xl font-semibold">Start with one NovaMart account</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Your customer account can become a seller account after admin verification.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login"><Button>Sign in</Button></Link>
              <Link href="/register"><Button variant="secondary">Create account</Button></Link>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  if (isApprovedSeller) {
    return (
      <AppShell>
        <PageHeader title="Your seller store is approved" eyebrow="Seller verification" icon={<CheckCircle2 className="size-4" />}>
          Your application has been approved. Continue to Seller Studio to manage products, orders, and customer reviews.
        </PageHeader>
        <section className="mx-auto grid max-w-5xl gap-5 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-xl border border-success/30 bg-card shadow-[var(--shadow-soft)]">
            <div className="border-b border-success/20 bg-success/10 p-6">
              <Badge tone="good">Approved seller</Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">{seller?.store_name || application?.store_name}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Admin verification is complete. You no longer need to submit another seller application unless an admin asks for updated details later.
              </p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Reviewed</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(application?.reviewed_at)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Trust score</p>
                <p className="mt-1 font-mono text-2xl font-semibold">{seller?.trust_score || 75}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Store status</p>
                <p className="mt-1 text-sm font-semibold capitalize">{seller?.status || "active"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-border p-6">
              <Link href="/seller/dashboard"><Button>Go to seller dashboard</Button></Link>
              <Link href="/seller/products"><Button variant="secondary">Manage products</Button></Link>
            </div>
          </div>
          <aside className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <h2 className="font-semibold">Verified documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">Documents linked to your approved application.</p>
            <div className="mt-4"><DocumentChecklist application={application} uploadedTypes={uploadedTypes} /></div>
            {application?.admin_notes ? (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <p className="font-semibold">Admin note</p>
                <p className="mt-1 leading-6 text-muted-foreground">{application.admin_notes}</p>
              </div>
            ) : null}
          </aside>
        </section>
      </AppShell>
    );
  }

  if (isPending) {
    return (
      <AppShell>
        <PageHeader title="Seller application under review" eyebrow="Verification queued" icon={<Clock3 className="size-4" />}>
          Your application is in the admin queue. We will notify you as soon as the verification team approves it or asks for updates.
        </PageHeader>
        <section className="mx-auto grid max-w-5xl gap-5 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-warning/30 bg-card p-6 shadow-[var(--shadow-soft)]">
            <Badge tone="warn">Pending review</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">{application?.store_name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sentra has scored your application and admins are reviewing your identity, documents, and payout readiness.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(application?.submitted_at)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Seller score label</p>
                <p className="mt-1 text-sm font-semibold">{application?.risk_label}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Seller score</p>
                <p className="mt-1 font-mono text-2xl font-semibold">{application?.risk_score}<span className="text-xs text-muted-foreground">/100</span></p>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="mb-3 font-semibold">Document checklist</h3>
              <DocumentChecklist application={application} uploadedTypes={uploadedTypes} />
            </div>
          </div>
          <aside className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <h2 className="font-semibold">What happens next?</h2>
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
              <p className="rounded-lg bg-muted/30 p-3">1. Admins verify your documents and bank summary.</p>
              <p className="rounded-lg bg-muted/30 p-3">2. If something is missing, you will see a change request here.</p>
              <p className="rounded-lg bg-muted/30 p-3">3. Once approved, this page changes into your seller access confirmation.</p>
            </div>
          </aside>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Become a NovaMart seller" eyebrow="Store verification" icon={<ShieldCheck className="size-4" />}>
        Submit your store details, bank details, and identity documents. Sentra scores the application so admins can verify sellers with clear reasons.
      </PageHeader>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1.25fr_0.75fr]">
        <form onSubmit={submitApplication} className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Seller application</h2>
              <p className="mt-1 text-sm text-muted-foreground">Known profile details are filled in for you.</p>
            </div>
            {application ? <Badge tone={statusTone(application.status)}>{statusLabel(application.status)}</Badge> : null}
          </div>

          {application?.status === "changes_requested" || application?.status === "rejected" ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-9 place-items-center rounded-lg bg-warning/15 text-warning">
                  <AlertTriangle className="size-4" />
                </span>
                <div>
                  <h3 className="font-semibold">
                    {application.status === "changes_requested" ? "Admin requested changes" : "Application was rejected"}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {application.admin_notes || "Review your details and upload updated documents before submitting again."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Application type
              <select
                value={form.application_type}
                onChange={(event) => updateField("application_type", event.target.value as FormState["application_type"])}
                className="min-h-11 rounded-md border border-border bg-card px-3 outline-none ring-primary/25 focus:border-primary focus:ring-4"
              >
                <option value="personal">Personal seller</option>
                <option value="business">Registered business</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Business or personal name
              <Input value={form.business_or_personal_name} onChange={(event) => updateField("business_or_personal_name", event.target.value)} required />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Email
              <Input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Phone number
              <Input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Store name
              <Input value={form.store_name} onChange={(event) => updateField("store_name", event.target.value)} required placeholder="Example: Kandy Home Studio" />
            </label>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="mt-0.5 grid size-9 place-items-center rounded-md bg-primary/12 text-primary">
                <Banknote className="size-4" />
              </span>
              <div>
                <h3 className="font-semibold">Bank details</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Used by admins to verify seller payout readiness before approving your store.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Bank name
                <Input value={form.bank_name} onChange={(event) => updateField("bank_name", event.target.value)} placeholder="Commercial Bank" required />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Account holder name
                <Input value={form.account_holder} onChange={(event) => updateField("account_holder", event.target.value)} placeholder="Name on bank account" required />
              </label>
              <label className="grid gap-2 text-sm font-semibold md:col-span-2">
                Bank account number
                <Input
                  inputMode="numeric"
                  value={form.account_number}
                  onChange={(event) => updateField("account_number", event.target.value.replace(/\D/g, ""))}
                  placeholder="Enter account number"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold md:col-span-2">
                Payment notes
                <Textarea
                  value={form.payment_notes}
                  onChange={(event) => updateField("payment_notes", event.target.value)}
                  placeholder="Branch, settlement preference, or admin note."
                />
              </label>
            </div>
          </div>

          <label className="grid gap-2 text-sm font-semibold">
            Store address
            <Textarea value={form.address} onChange={(event) => updateField("address", event.target.value)} required />
          </label>
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            {DOC_CHECKLIST.map(([key, label, helper]) => {
              const f = files[key];
              const displayName = f ? shortFileName(f.name, 22) : "Choose document";
              return (
                <label key={key} className="grid min-w-0 gap-3 overflow-hidden rounded-lg border border-border bg-muted/30 p-4 text-sm">
                  <span className="flex min-w-0 items-center justify-between gap-2 font-semibold">
                    <span className="min-w-0 truncate">{label}</span>
                    {uploadedTypes.has(key) ? (
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                    ) : (
                      <UploadCloud className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{helper}</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="sr-only"
                    onChange={(event) => setFiles((current) => ({ ...current, [key]: event.target.files?.[0] || null }))}
                  />
                  <span
                    title={f?.name ?? undefined}
                    className="flex min-h-12 w-full min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2 transition hover:border-primary/60"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <UploadCloud className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-foreground">
                        {displayName}
                      </span>
                      <span className="block max-w-full truncate text-[11px] font-normal text-muted-foreground">
                        {f ? "Selected file" : "PDF, PNG, JPG, or JPEG"}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {error ? <p className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
          {status ? <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{status}</p> : null}
          <Button type="submit" disabled={saving || !canResubmit}>{saving ? "Sending verification..." : application ? "Resubmit for verification" : "Submit for verification"}</Button>
        </form>

        <aside className="grid content-start gap-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-lg bg-primary/12 text-primary"><FileCheck2 className="size-5" /></span>
              <div>
                <h2 className="font-semibold">Sentra seller score</h2>
                <p className="text-sm text-muted-foreground">Higher is better. Deductions show what lowered the score.</p>
              </div>
            </div>
            {application ? (
              <div className="mt-5">
                <div className="flex items-end justify-between">
                  <Badge tone={reasonTone(application.risk_score)}>{application.risk_label}</Badge>
                  <span className="font-mono text-3xl font-semibold">{application.risk_score}<span className="text-sm text-muted-foreground">/100</span></span>
                </div>
                <div className="mt-4 grid gap-2">
                  {(application.risk_reasons || []).slice(0, 6).map((reason) => (
                    <div key={`${reason.rule_code}-${reason.reason}`} className="rounded-md bg-muted/45 p-3 text-sm">
                      <p>{reason.reason}</p>
                      <p className="mt-1 font-mono text-xs text-danger">−{reason.score_impact || 0} pts</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Submit the form to generate the first seller risk report.</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <Store className="size-5 text-primary" />
            <h2 className="mt-4 font-semibold">After approval</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">You can open Seller Studio, submit products for review, track seller orders, and monitor review risks on your own listings.</p>
            {seller ? <Link href="/seller/dashboard" className="mt-5 inline-flex"><Button variant="secondary">Open seller studio</Button></Link> : null}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
