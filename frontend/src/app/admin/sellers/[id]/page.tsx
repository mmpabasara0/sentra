"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, ShieldCheck, Store, UserCheck, X, XCircle } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import type { SellerApplication, SellerDocument } from "@/lib/types";
import { api } from "@/services/api";

type SignedDocument = {
  document: SellerDocument;
  signed_url: string;
};

function statusLabel(status?: string) {
  return (status || "pending").replaceAll("_", " ");
}

function statusTone(status?: string) {
  if (status === "approved" || status === "verified") return "good";
  if (status === "rejected") return "bad";
  return "warn";
}

function isImage(document?: SellerDocument) {
  const name = document?.original_name?.toLowerCase() || "";
  return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp") || name.endsWith(".gif");
}

function isPdf(document?: SellerDocument) {
  return (document?.original_name?.toLowerCase() || "").endsWith(".pdf");
}

export default function AdminSellerApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [application, setApplication] = useState<SellerApplication | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [actioning, setActioning] = useState<"approve" | "reject" | "request-changes" | null>(null);
  const [viewer, setViewer] = useState<SignedDocument | null>(null);
  const [documentLoading, setDocumentLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    const data = await api.get<{ application: SellerApplication }>(`/admin/seller-applications/${id}`, token);
    setApplication(data.application);
    setNotes(data.application?.admin_notes || "");
  }, [id, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(action: "approve" | "reject" | "request-changes") {
    if (!token || !id) return;
    setActioning(action);
    setError("");
    setMessage("");
    try {
      const data = await api.post<{ application: SellerApplication }>(`/admin/seller-applications/${id}/${action}`, { notes }, token);
      setApplication(data.application);
      setMessage(`Application ${action.replace("-", " ")} completed.`);
    } catch (err) {
      setError((err as Error).message || "Could not update seller application.");
    } finally {
      setActioning(null);
    }
  }

  async function openDocument(documentId: string) {
    if (!token) return;
    setDocumentLoading(documentId);
    setError("");
    try {
      const data = await api.get<SignedDocument>(`/admin/seller-documents/${documentId}/download`, token);
      setViewer(data);
    } catch (err) {
      setError((err as Error).message || "Could not open seller document.");
    } finally {
      setDocumentLoading(null);
    }
  }

  const canAct = application?.status === "pending" || application?.status === "changes_requested";

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <Store className="size-3" />
            Admin verification
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            {application ? application.store_name : "Seller application"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Review seller identity, bank summary, uploaded documents, and Sentra seller score deductions.
          </p>
        </header>
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          {application ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
                <div>
                  <h2 className="text-2xl font-semibold">{application.business_or_personal_name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{application.email} · {application.phone}</p>
                </div>
                <Badge tone={statusTone(application.status)}>{statusLabel(application.status)}</Badge>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><span className="text-muted-foreground">Type:</span> {application.application_type}</p>
                <p><span className="text-muted-foreground">Store:</span> {application.store_name}</p>
                <p><span className="text-muted-foreground">Bank:</span> {application.bank_name || "Not provided"}</p>
                <p><span className="text-muted-foreground">Account holder:</span> {application.account_holder || "Not provided"}</p>
                <p className="md:col-span-2">
                  <span className="text-muted-foreground">Account number:</span>{" "}
                  <span className="font-mono break-all">
                    {application.account_number || (application.account_number_last4 ? `•••• ${application.account_number_last4}` : "Not provided")}
                  </span>
                </p>
                <p className="md:col-span-2"><span className="text-muted-foreground">Address:</span> {application.address}</p>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Uploaded documents</h3>
                  <span className="text-xs text-muted-foreground">{application.seller_documents?.length || 0} files</span>
                </div>
                {(application.seller_documents || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                    No documents were uploaded with this application.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    {(application.seller_documents || []).map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => openDocument(document.id)}
                        className="min-w-0 rounded-lg border border-border bg-muted/35 p-4 text-left transition hover:border-primary/50 hover:bg-muted"
                        title={document.original_name}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <FileText className="size-5 shrink-0 text-primary" />
                          <Badge tone={statusTone(document.verification_status)}>{statusLabel(document.verification_status)}</Badge>
                        </div>
                        <p className="mt-3 truncate font-semibold">{document.document_type.replaceAll("_", " ")}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{document.original_name}</p>
                        <p className="mt-3 text-xs font-semibold text-primary">
                          {documentLoading === document.id ? "Preparing secure link..." : "View document"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label className="grid gap-2 text-sm font-semibold">
                Admin notes
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Reason for approval, rejection, or requested changes." />
              </label>
              {message ? <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{message}</p> : null}
              {error ? <p className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
              {!canAct && application.status !== "pending" ? (
                <p className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  This application is {statusLabel(application.status)}. Actions are locked unless the seller resubmits or the status changes.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button disabled={!canAct || Boolean(actioning)} onClick={() => act("approve")}>
                  {actioning === "approve" ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />} Approve seller
                </Button>
                <Button disabled={!canAct || Boolean(actioning)} variant="secondary" onClick={() => act("request-changes")}>
                  {actioning === "request-changes" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Request changes
                </Button>
                <Button disabled={!canAct || Boolean(actioning)} variant="danger" onClick={() => act("reject")}>
                  {actioning === "reject" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Reject
                </Button>
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">Loading seller application...</p>}
        </div>

        <aside className="grid content-start gap-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-xl font-semibold">Sentra seller score</h2>
            <p className="mt-1 text-sm text-muted-foreground">Higher is better. Each item below deducts points.</p>
            {application ? (
              <>
                <div className="mt-5 flex items-end justify-between">
                  <Badge tone={application.risk_score >= 80 ? "good" : application.risk_score >= 60 ? "warn" : "bad"}>{application.risk_label}</Badge>
                  <span className="font-mono text-3xl font-semibold">{application.risk_score}<span className="text-sm text-muted-foreground">/100</span></span>
                </div>
                <div className="mt-4 grid gap-2">
                  {(application.risk_reasons || []).map((reason) => (
                    <div key={`${reason.rule_code}-${reason.reason}`} className="rounded-md bg-muted/40 p-3 text-sm">
                      <p>{reason.reason}</p>
                      <p className="mt-1 font-mono text-xs text-danger">−{reason.score_impact || 0} pts</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </aside>
      </section>
      </div>
      {viewer ? (
        <div className="fixed inset-0 z-[260] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="grid max-h-[92vh] w-[min(980px,100%)] overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-4 border-b border-border p-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Seller document</p>
                <h2 className="mt-1 truncate text-xl font-semibold">{viewer.document.document_type.replaceAll("_", " ")}</h2>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={viewer.document.original_name}>{viewer.document.original_name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={viewer.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold hover:bg-muted"
                >
                  <ExternalLink className="size-3.5" /> Open
                </a>
                <button
                  type="button"
                  aria-label="Close document viewer"
                  onClick={() => setViewer(null)}
                  className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex h-[70vh] items-center justify-center overflow-auto bg-[#1a1a1a]">
              {isImage(viewer.document) ? (
                // Images: must use <img> — Supabase storage sets X-Frame-Options: DENY,
                // which blocks iframe embedding even for signed URLs.
                <img
                  src={viewer.signed_url}
                  alt={viewer.document.original_name}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = "none";
                    const fallback = target.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "grid";
                  }}
                />
              ) : isPdf(viewer.document) ? (
                <iframe
                  title={viewer.document.original_name}
                  src={viewer.signed_url}
                  className="h-full w-full border-0"
                />
              ) : null}
              {/* Shared fallback shown when image fails to load or file type is not previewable */}
              <div
                className="hidden h-full w-full place-items-center p-8 text-center"
                style={{ display: (!isImage(viewer.document) && !isPdf(viewer.document)) ? "grid" : "none" }}
              >
                <div>
                  <FileText className="mx-auto size-10 text-primary" />
                  <h3 className="mt-3 font-semibold text-white">Preview not available</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Open the secure link in a new tab to view or download it.</p>
                  <a
                    href={viewer.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    <ExternalLink className="size-4" /> Open document
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
