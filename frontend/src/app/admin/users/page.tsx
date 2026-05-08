"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
  Store,
  Trash2,
  Undo2,
  UserCog,
  UsersRound,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";
import type { RiskReason } from "@/lib/types";

type AdminUser = {
  id: string;
  full_name: string;
  username: string;
  role: "customer" | "seller" | "admin";
  status: "active" | "monitored" | "restricted";
  created_at?: string;
  trust: {
    trust_score: number;
    trust_label: string;
    approved_reviews: number;
    flagged_reviews: number;
    rejected_reviews: number;
  };
  seller?: {
    id: string;
    store_name: string;
    status: "active" | "suspended" | "restricted";
    trust_score: number;
  } | null;
  seller_score?: {
    score: number | null;
    label: string;
    tone: "good" | "warn" | "bad" | "neutral";
    seller_score: number | null;
    application_score: number | null;
    application_label: string;
    application_id: string | null;
    application_status: string | null;
    store_name: string;
    reasons: RiskReason[];
    documents_uploaded: number;
    missing_documents: string[];
    score_gap: number;
    score_synced: boolean;
    updated_at?: string;
  } | null;
};

type Filter = "all" | "risk" | "sellers" | "restricted" | "admins";

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium" }).format(new Date(iso));
}

function roleTone(role: AdminUser["role"]): "good" | "warn" | "neutral" {
  if (role === "admin") return "warn";
  if (role === "seller") return "good";
  return "neutral";
}

function statusTone(status: AdminUser["status"]): "good" | "warn" | "bad" {
  if (status === "restricted") return "bad";
  if (status === "monitored") return "warn";
  return "good";
}

export default function UsersManagementPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ users: AdminUser[] }>("/admin/users", token);
      setUsers(data.users || []);
    } catch (e) {
      setError((e as Error).message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const counts = useMemo(() => {
    return {
      all: users.length,
      risk: users.filter((u) => u.trust.trust_score <= 70).length,
      sellers: users.filter((u) => u.role === "seller" || u.seller).length,
      restricted: users.filter((u) => u.status === "restricted").length,
      admins: users.filter((u) => u.role === "admin").length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    let list = users;
    if (filter === "risk") list = list.filter((u) => u.trust.trust_score <= 70);
    if (filter === "sellers") list = list.filter((u) => u.role === "seller" || u.seller);
    if (filter === "restricted") list = list.filter((u) => u.status === "restricted");
    if (filter === "admins") list = list.filter((u) => u.role === "admin");
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.full_name.toLowerCase().includes(q) ||
          (u.seller?.store_name || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [users, filter, query]);

  async function runAction(actionKey: string, label: string, request: () => Promise<unknown>) {
    setBusy(actionKey);
    setError(null);
    setNotice(null);
    try {
      await request();
      await loadUsers();
      setNotice(label);
      window.setTimeout(() => setNotice(null), 2500);
    } catch (e) {
      setError((e as Error).message || "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  function notes(action: string, user: AdminUser) {
    return `${action} from admin user management for @${user.username}`;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <UsersRound className="size-3.5" />
            Account operations
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Users management</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            View every account, inspect trust and seller status, restrict risky users, monitor accounts, and remove seller access with audit logging.
          </p>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              { id: "all" as const, label: "All users", value: counts.all },
              { id: "risk" as const, label: "Risk users", value: counts.risk },
              { id: "sellers" as const, label: "Sellers", value: counts.sellers },
              { id: "restricted" as const, label: "Banned", value: counts.restricted },
              { id: "admins" as const, label: "Admins", value: counts.admins },
            ]
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={`rounded-2xl border p-4 text-left shadow-[0_18px_55px_-45px_var(--foreground)] ${
                filter === c.id
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-card/45 hover:border-primary/30 hover:bg-card/70"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{c.label}</p>
              <p className="mt-2 font-mono text-3xl font-semibold tracking-tight">{c.value}</p>
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card/35 p-3 md:flex-row md:items-center md:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username, name, or store..."
              className="min-h-10 w-full rounded-xl border border-border bg-background/70 pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all" as const, label: "All" },
                { id: "risk" as const, label: "Risk" },
                { id: "sellers" as const, label: "Sellers" },
                { id: "restricted" as const, label: "Banned" },
                { id: "admins" as const, label: "Admins" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`min-h-9 rounded-full px-4 text-xs font-semibold ${
                  filter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notices */}
        {notice ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="size-5" /> {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <AlertTriangle className="size-5" /> {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-muted/40 shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid min-h-60 place-items-center rounded-2xl border border-dashed border-border bg-card/35 p-8 text-center">
            <div>
              <UsersRound className="mx-auto size-9 text-primary" />
              <p className="mt-3 text-sm font-semibold">No users found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different search or filter.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
              {filtered.map((u) => {
                const isBusy = busy?.startsWith(u.id);
                return (
                  <article
                    key={u.id}
                    className={`rounded-2xl border border-border bg-card/55 p-4 shadow-[var(--shadow-soft)] ${
                      isBusy ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    <div className="grid gap-4 xl:grid-cols-[1.05fr_1.15fr_1.3fr] xl:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={roleTone(u.role)}>{u.role}</Badge>
                          <Badge tone={statusTone(u.status)}>{u.status === "restricted" ? "banned" : u.status}</Badge>
                          {u.seller ? <Badge tone={u.seller.status === "active" ? "good" : "bad"}>seller {u.seller.status}</Badge> : null}
                        </div>
                        <h2 className="mt-3 text-lg font-semibold tracking-tight">
                          {u.full_name || u.username || "Unnamed account"}
                        </h2>
                        <p className="font-mono text-xs text-muted-foreground">@{u.username}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Joined {fmtDate(u.created_at)}</p>
                        {u.seller?.store_name ? <p className="mt-1 truncate text-xs text-muted-foreground">Store: {u.seller.store_name}</p> : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border bg-background/45 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Trust score</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="font-mono text-2xl font-semibold">{u.trust.trust_score}</span>
                            <Badge tone={u.trust.trust_score <= 30 ? "bad" : u.trust.trust_score <= 70 ? "warn" : "good"}>
                              {u.trust.trust_label}
                            </Badge>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={
                                u.trust.trust_score <= 30 ? "h-full bg-danger" : u.trust.trust_score <= 70 ? "h-full bg-warning" : "h-full bg-success"
                              }
                              style={{ width: `${u.trust.trust_score}%` }}
                            />
                          </div>
                          <div className="mt-2 flex gap-2 font-mono text-[10px]">
                            <span className="text-success">A {u.trust.approved_reviews}</span>
                            <span className="text-warning">F {u.trust.flagged_reviews}</span>
                            <span className="text-danger">R {u.trust.rejected_reviews}</span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border bg-background/45 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Seller score</p>
                          {u.seller_score ? (
                            <>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="font-mono text-2xl font-semibold">{u.seller_score.score ?? "—"}</span>
                                <Badge tone={u.seller_score.tone}>{u.seller_score.label}</Badge>
                                {!u.seller_score.score_synced ? <Badge tone="warn">gap</Badge> : null}
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={
                                    (u.seller_score.score ?? 0) >= 80
                                      ? "h-full bg-success"
                                      : (u.seller_score.score ?? 0) >= 60
                                        ? "h-full bg-warning"
                                        : "h-full bg-danger"
                                  }
                                  style={{ width: `${u.seller_score.score ?? 0}%` }}
                                />
                              </div>
                              <p className="mt-2 truncate text-[10px] text-muted-foreground">{u.seller_score.store_name || u.seller?.store_name || "No store"}</p>
                            </>
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">No seller data</p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold hover:bg-muted"
                        >
                          <Eye className="size-3.5" /> View details
                        </Link>

                        {u.seller_score?.application_id ? (
                          <Button
                            variant="outline"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(`${u.id}:seller-score`, `Seller score recalculated for @${u.username}.`, () =>
                                api.post(`/admin/users/${u.id}/seller-score/recalculate`, {}, token),
                              )
                            }
                          >
                            <RefreshCw className="size-3.5" /> Recalculate
                          </Button>
                        ) : null}

                        {u.status !== "monitored" ? (
                          <Button
                            variant="secondary"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(`${u.id}:monitor`, `@${u.username} is now monitored.`, () =>
                                api.post(`/admin/users/${u.id}/status`, { status: "monitored", notes: notes("Monitor", u) }, token),
                              )
                            }
                          >
                            <AlertTriangle className="size-3.5" /> Monitor
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(`${u.id}:active`, `@${u.username} is active again.`, () =>
                                api.post(`/admin/users/${u.id}/status`, { status: "active", notes: notes("Reactivate", u) }, token),
                              )
                            }
                          >
                            <CheckCircle2 className="size-3.5" /> Unmonitor
                          </Button>
                        )}

                        {u.status !== "restricted" ? (
                          <Button
                            variant="danger"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() => {
                              if (!window.confirm(`Ban @${u.username}? They will be blocked from using protected account features.`)) return;
                              void runAction(`${u.id}:ban`, `@${u.username} has been banned.`, () =>
                                api.post(`/admin/users/${u.id}/status`, { status: "restricted", notes: notes("Ban", u) }, token),
                              );
                            }}
                          >
                            <Ban className="size-3.5" /> Ban
                          </Button>
                        ) : (
                          <Button
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(`${u.id}:unban`, `@${u.username} has been reactivated.`, () =>
                                api.post(`/admin/users/${u.id}/status`, { status: "active", notes: notes("Unban", u) }, token),
                              )
                            }
                          >
                            <Undo2 className="size-3.5" /> Unban
                          </Button>
                        )}

                        {u.seller && u.seller.status === "active" ? (
                          <Button
                            variant="danger"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() => {
                              if (!window.confirm(`Remove seller access for @${u.username}? Their store will be suspended.`)) return;
                              void runAction(`${u.id}:remove-seller`, `Seller access removed for @${u.username}.`, () =>
                                api.post(`/admin/users/${u.id}/remove-seller`, { notes: notes("Remove seller access", u) }, token),
                              );
                            }}
                          >
                            <Store className="size-3.5" /> Remove seller
                          </Button>
                        ) : u.seller ? (
                          <Button
                            variant="secondary"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(`${u.id}:restore-seller`, `Seller access restored for @${u.username}.`, () =>
                                api.post(`/admin/users/${u.id}/restore-seller`, { notes: notes("Restore seller access", u) }, token),
                              )
                            }
                          >
                            <Store className="size-3.5" /> Restore seller
                          </Button>
                        ) : null}

                        {u.role !== "admin" ? (
                          <Button
                            variant="outline"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() => {
                              if (!window.confirm(`Make @${u.username} an admin?`)) return;
                              void runAction(`${u.id}:admin`, `@${u.username} is now an admin.`, () =>
                                api.post(`/admin/users/${u.id}/role`, { role: "admin", notes: notes("Promote admin", u) }, token),
                              );
                            }}
                          >
                            <ShieldCheck className="size-3.5" /> Make admin
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() => {
                              if (!window.confirm(`Demote @${u.username} from admin to customer?`)) return;
                              void runAction(`${u.id}:customer`, `@${u.username} is now a customer.`, () =>
                                api.post(`/admin/users/${u.id}/role`, { role: "customer", notes: notes("Demote admin", u) }, token),
                              );
                            }}
                          >
                            <ShieldX className="size-3.5" /> Remove admin
                          </Button>
                        )}

                        {u.role !== "seller" && !u.seller ? (
                          <Button
                            variant="outline"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(`${u.id}:seller-role`, `@${u.username} role changed to seller.`, () =>
                                api.post(`/admin/users/${u.id}/role`, { role: "seller", notes: notes("Set seller role", u) }, token),
                              )
                            }
                          >
                            <UserCog className="size-3.5" /> Set seller role
                          </Button>
                        ) : u.role === "seller" && !u.seller ? (
                          <Button
                            variant="outline"
                            className="min-h-10 px-3 text-xs"
                            disabled={isBusy}
                            onClick={() => {
                              if (!window.confirm(`Remove seller role from @${u.username}?`)) return;
                              void runAction(`${u.id}:remove-seller-role`, `Seller role removed from @${u.username}.`, () =>
                                api.post(`/admin/users/${u.id}/role`, { role: "customer", notes: notes("Remove seller role", u) }, token),
                              );
                            }}
                          >
                            <Store className="size-3.5" /> Remove seller role
                          </Button>
                        ) : null}

                        {u.role !== "admin" ? (
                          <Button
                            variant="outline"
                            className="min-h-10 px-3 text-xs text-danger hover:bg-danger/10"
                            disabled={isBusy}
                            onClick={() => {
                              if (!window.confirm(`Permanently delete @${u.username}? This cannot be undone.`)) return;
                              void runAction(`${u.id}:delete`, `@${u.username} has been removed.`, () =>
                                api.delete(`/admin/users/${u.id}`, token),
                              );
                            }}
                          >
                            <Trash2 className="size-3.5" /> Remove user
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
