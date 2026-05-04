"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";

import {
  type AppNotification,
  type NotificationCategory,
  NotifIcon,
  useNotifications,
} from "@/context/notification-context";
import { cn } from "@/lib/utils";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotifRow({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  const isAlert = n.type === "review_flagged" || n.type === "sentra_alert" || n.type === "product_rejected" || n.type === "seller_application_rejected";
  const Inner = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
        !n.read && "bg-primary/5",
      )}
      onClick={() => onRead(n.id)}
    >
      <div
        className={cn(
          "mt-0.5 grid size-7 flex-shrink-0 place-items-center rounded-lg",
          isAlert ? "bg-danger/12" : "bg-primary/10",
        )}
      >
        <NotifIcon type={n.type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-tight", !n.read && "font-semibold")}>{n.title}</p>
          <span className="flex-shrink-0 text-[10px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{n.message}</p>
      </div>
      {!n.read && (
        <span className="mt-1.5 size-2 flex-shrink-0 rounded-full bg-primary" />
      )}
    </div>
  );

  if (n.href) {
    return <Link href={n.href}>{Inner}</Link>;
  }
  return <div className="cursor-default">{Inner}</div>;
}

export function NotificationBell({ category }: { category: NotificationCategory }) {
  const { notifications, markRead, markAllRead, clear, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const categoryNotifs = notifications
    .filter((n) => n.category === category)
    .slice(0, 30);
  const unread = unreadCount(category);

  // Close on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = category === "admin" ? "Admin notifications" : category === "seller" ? "Seller notifications" : "Notifications";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`${label} — ${unread} unread`}
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-10 place-items-center rounded-md border border-border bg-card/70 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white leading-[18px]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[200] mt-2 w-[340px] max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{label}</p>
              {unread > 0 && (
                <p className="text-xs text-muted-foreground">{unread} unread</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  title="Mark all read"
                  onClick={() => markAllRead(category)}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <CheckCheck className="size-4" />
                </button>
              )}
              {categoryNotifs.length > 0 && (
                <button
                  type="button"
                  title="Clear all"
                  onClick={() => clear(category)}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {categoryNotifs.length === 0 ? (
              <div className="grid place-items-center gap-2 px-4 py-10 text-center">
                <Bell className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground/60">
                  {category === "seller"
                    ? "Order updates, product approvals and Sentra alerts will appear here."
                    : category === "admin"
                    ? "New seller applications, flagged reviews and product reviews will appear here."
                    : "Order confirmations and review updates will appear here."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {categoryNotifs.map((n) => (
                  <NotifRow key={n.id} n={n} onRead={(id) => { markRead(id); }} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {categoryNotifs.length > 0 && (
            <div className="border-t border-border px-4 py-2.5 text-center">
              <Link
                href={category === "admin" ? "/admin/dashboard" : category === "seller" ? "/seller/dashboard" : "/dashboard"}
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                Go to {category === "admin" ? "admin dashboard" : category === "seller" ? "seller studio" : "account dashboard"}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
