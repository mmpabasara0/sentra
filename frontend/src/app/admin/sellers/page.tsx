"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Store, UserCheck, XCircle } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/context/notification-context";
import { useAuth } from "@/context/auth-context";
import type { SellerApplication } from "@/lib/types";
import { api } from "@/services/api";

type QueueFilter = "all" | SellerApplication["status"];

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function statusTone(status: SellerApplication["status"]) {
  if (status === "approved") return "good";
  if (status === "rejected") return "bad";
  return "warn";
}

export default function AdminSellerApplicationsPage() {
  const { token } = useAuth();
  const { notifications } = useNotifications();
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QueueFilter>("all");

  const loadApplications = useCallback(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    api
      .get<{ applications: SellerApplication[] }>("/admin/seller-applications", token)
      .then((data) => {
        if (alive) setApplications(data.applications || []);
      })
      .catch(() => {
        if (alive) setApplications([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      cleanup = loadApplications() || undefined;
    }, 0);
    return () => {
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, [loadApplications]);

  const sellerQueueSignal = useMemo(
    () =>
      notifications
        .filter((n) => n.category === "admin" && (n.type === "seller_application_submitted" || n.type === "seller_document_uploaded"))
        .map((n) => n.id)
        .join(","),
    [notifications],
  );

  useEffect(() => {
    if (!sellerQueueSignal) return;
    let cleanup: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      cleanup = loadApplications() || undefined;
    }, 0);
    return () => {
      window.clearTimeout(timer);
      cleanup?.();
    };
  }, [loadApplications, sellerQueueSignal]);

  const pending = applications.filter((a) => a.status === "pending");
  const changesRequested = applications.filter((a) => a.status === "changes_requested");
  const approved = applications.filter((a) => a.status === "approved");
  const rejected = applications.filter((a) => a.status === "rejected");
  const visibleApplications = useMemo(
    () => (filter === "all" ? applications : applications.filter((application) => application.status === filter)),
    [applications, filter],
  );
  const filters: Array<{ key: QueueFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: applications.length },
    { key: "pending", label: "Pending", count: pending.length },
    { key: "changes_requested", label: "Changes requested", count: changesRequested.length },
    { key: "approved", label: "Approved", count: approved.length },
    { key: "rejected", label: "Rejected", count: rejected.length },
  ];

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <Store className="size-3" />
            Sentra seller integrity
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Seller verification queue</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Inspect seller applications, document status, and risk reasons before approving store access.
          </p>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-warning/25 bg-warning/10 p-4">
            <Clock3 className="size-4 text-warning" />
            <p className="mt-3 text-xs text-muted-foreground">Pending review</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-warning">{pending.length}</p>
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
            <AlertTriangle className="size-4 text-primary" />
            <p className="mt-3 text-xs text-muted-foreground">Changes requested</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-primary">{changesRequested.length}</p>
          </div>
          <div className="rounded-xl border border-success/25 bg-success/10 p-4">
            <CheckCircle2 className="size-4 text-success" />
            <p className="mt-3 text-xs text-muted-foreground">Approved</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-success">{approved.length}</p>
          </div>
          <div className="rounded-xl border border-danger/25 bg-danger/10 p-4">
            <XCircle className="size-4 text-danger" />
            <p className="mt-3 text-xs text-muted-foreground">Rejected</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-danger">{rejected.length}</p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === item.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/55 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label} <span className="ml-1 font-mono">{item.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted shimmer" />
            ))}
          </div>
        ) : visibleApplications.length === 0 ? (
          <div className="grid min-h-60 place-items-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
            <div>
              <Store className="mx-auto size-8 text-primary" />
              <h2 className="mt-3 text-sm font-semibold">No seller applications in this view</h2>
              <p className="mt-1 text-xs text-muted-foreground">New seller requests and status changes will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleApplications.map((application) => (
              <article
                key={application.id}
                className={`grid gap-4 rounded-xl border bg-card/55 p-5 shadow-[var(--shadow-soft)] md:grid-cols-[1fr_auto] ${
                  application.status === "pending" ? "border-warning/35" : application.status === "changes_requested" ? "border-primary/35" : "border-border"
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(application.status)}>{statusLabel(application.status)}</Badge>
                    <Badge
                      tone={
                        application.risk_score >= 80 ? "good" : application.risk_score >= 60 ? "warn" : "bad"
                      }
                    >
                      {application.risk_label}
                    </Badge>
                    <span className="font-mono text-sm text-muted-foreground">{application.risk_score}/100</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-tight">{application.store_name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {application.business_or_personal_name} · {application.email} · {application.phone}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {application.seller_documents?.length || 0} document uploads · submitted {application.submitted_at ? new Date(application.submitted_at).toLocaleString() : "recently"}
                  </p>
                  {application.admin_notes ? (
                    <p className="mt-2 line-clamp-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Admin note: {application.admin_notes}
                    </p>
                  ) : null}
                </div>
                <Link href={`/admin/sellers/${application.id}`} className="self-center md:self-auto">
                  <Button variant="secondary">
                    <UserCheck className="size-4" /> Review
                  </Button>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
