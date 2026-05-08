"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, ShieldAlert, ShieldX } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";

type Log = {
  id: string;
  admin_id: string;
  target_type: string;
  target_id: string;
  action: string;
  notes?: string;
  created_at: string;
  profiles?: { username?: string; full_name?: string };
};

type ActivityLog = {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  metadata_json?: Record<string, unknown>;
  created_at: string;
  profiles?: { username?: string; full_name?: string };
};

type Tab = "moderation" | "activity";

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function actionIcon(action: string) {
  if (action.includes("approve")) return CheckCircle2;
  if (action.includes("reject")) return ShieldX;
  if (action.includes("quarantine")) return ShieldAlert;
  return AlertTriangle;
}

function actionTone(action: string) {
  if (action.includes("approve")) return "text-success bg-success/14";
  if (action.includes("reject")) return "text-danger bg-danger/14";
  if (action.includes("quarantine")) return "text-warning bg-warning/14";
  return "text-muted-foreground bg-muted";
}

export default function ModerationLogsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("moderation");
  const [modLogs, setModLogs] = useState<Log[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      Promise.all([
        api.get<{ logs: Log[] }>("/admin/moderation-logs", token),
        api.get<{ logs: ActivityLog[] }>("/admin/activity-logs", token),
      ])
        .then(([m, a]) => {
          if (!alive) return;
          setModLogs(m.logs || []);
          setActivity(a.logs || []);
        })
        .catch(() => {
          if (alive) {
            setModLogs([]);
            setActivity([]);
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [token]);

  const filteredMod = useMemo(() => {
    if (!filter) return modLogs;
    const f = filter.toLowerCase();
    return modLogs.filter(
      (l) =>
        l.action.toLowerCase().includes(f) ||
        l.target_type.toLowerCase().includes(f) ||
        (l.profiles?.username || "").toLowerCase().includes(f) ||
        (l.notes || "").toLowerCase().includes(f),
    );
  }, [modLogs, filter]);

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
            <Activity className="size-3" />
            Audit trail
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Moderation &amp; activity logs</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every approve, reject, and quarantine decision is logged for accountability. Customer-side activity is also tracked for forensic analysis.
          </p>
        </header>

        {/* Tab switcher */}
        <div className="mb-4 inline-flex rounded-md border border-border bg-card/40 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("moderation")}
            className={`rounded px-3 py-1.5 font-medium transition-colors ${
              tab === "moderation" ? "bg-primary/14 text-primary" : "text-muted-foreground"
            }`}
          >
            Moderation actions
            <span className="ml-2 font-mono text-xs">{modLogs.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("activity")}
            className={`rounded px-3 py-1.5 font-medium transition-colors ${
              tab === "activity" ? "bg-primary/14 text-primary" : "text-muted-foreground"
            }`}
          >
            User activity
            <span className="ml-2 font-mono text-xs">{activity.length}</span>
          </button>
        </div>

        {tab === "moderation" && (
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by action, target, admin, or notes…"
            className="mb-4 min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        )}

        {loading ? (
          <div className="grid gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-md bg-muted shimmer" />
            ))}
          </div>
        ) : tab === "moderation" ? (
          filteredMod.length === 0 ? (
            <div className="grid min-h-60 place-items-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              No moderation actions yet. Approve or reject reviews to populate the audit trail.
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border bg-card/40 divide-y divide-border">
              {filteredMod.map((log) => {
                const Icon = actionIcon(log.action);
                return (
                  <li key={log.id} className="grid items-start gap-3 p-4 sm:grid-cols-[180px_1fr_auto]">
                    <div className="flex items-center gap-2">
                      <span className={`grid size-7 place-items-center rounded-md ${actionTone(log.action)}`}>
                        <Icon className="size-3.5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold capitalize">{log.action.replace("_", " ")}</p>
                        <p className="text-[11px] text-muted-foreground">{log.target_type}</p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Admin <span className="font-mono text-foreground">@{log.profiles?.username || "—"}</span>
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        Target ID: {log.target_id}
                      </p>
                      {log.notes && (
                        <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground/90">&quot;{log.notes}&quot;</p>
                      )}
                    </div>
                    <p className="text-right text-xs text-muted-foreground/70">{fmtTime(log.created_at)}</p>
                  </li>
                );
              })}
            </ul>
          )
        ) : activity.length === 0 ? (
          <div className="grid min-h-60 place-items-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No user activity recorded yet.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-card/40 divide-y divide-border">
            {activity.map((log) => (
              <li key={log.id} className="grid items-start gap-3 p-4 sm:grid-cols-[200px_1fr_auto]">
                <div>
                  <p className="text-sm font-semibold">{log.action_type.replace(/_/g, " ")}</p>
                  <p className="text-[11px] text-muted-foreground">{log.entity_type}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    User <span className="font-mono text-foreground">@{log.profiles?.username || "—"}</span>
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    Entity ID: {log.entity_id}
                  </p>
                </div>
                <p className="text-right text-xs text-muted-foreground/70">{fmtTime(log.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
