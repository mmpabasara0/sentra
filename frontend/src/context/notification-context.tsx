"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, PackageCheck, ShieldAlert, ShoppingBag, Star, X } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { playAdminSound, playCustomerSound, playSellerSound, playSuccessSound } from "@/lib/notification-sounds";
import { cn } from "@/lib/utils";
import { supabase } from "@/services/supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationCategory = "admin" | "customer" | "seller";

export type NotificationType =
  | "order_placed"
  | "order_update"
  | "review_submitted"
  | "review_flagged"
  | "review_approved"
  | "review_rejected"
  | "new_order"
  | "product_approved"
  | "product_rejected"
  | "seller_application_submitted"
  | "seller_application_approved"
  | "seller_application_rejected"
  | "seller_application_changes_requested"
  | "seller_application_pending"
  | "seller_document_uploaded"
  | "seller_product_submitted"
  | "sentra_alert"
  | "info";

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  href?: string;
};

type NotificationInput = Omit<AppNotification, "id" | "read" | "createdAt">;
type DbNotification = {
  id: string;
  profile_id: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  href?: string | null;
  read: boolean;
  created_at: string;
};

type NotificationCtx = {
  notifications: AppNotification[];
  notify: (n: NotificationInput) => void;
  markRead: (id: string) => void;
  markAllRead: (category: NotificationCategory) => void;
  clear: (category: NotificationCategory) => void;
  unreadCount: (category: NotificationCategory) => number;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationCtx | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

// ─── Toast internals ─────────────────────────────────────────────────────────

type ToastEntry = AppNotification & { dismissing: boolean };

const TOAST_DURATION = 4500;
const MAX_TOASTS = 3;

function toastTone(type: NotificationType, category: NotificationCategory) {
  if (type === "order_placed" || type === "product_approved") { playSuccessSound(); return; }
  if (category === "admin") { playAdminSound(); return; }
  if (category === "seller") { playSellerSound(); return; }
  playCustomerSound();
}

function ToastIcon({ type }: { type: NotificationType }) {
  const cls = "size-4 flex-shrink-0";
  if (type === "order_placed" || type === "product_approved") return <CheckCircle2 className={cn(cls, "text-success")} />;
  if (type === "review_flagged" || type === "sentra_alert" || type === "product_rejected" || type === "seller_application_rejected") return <ShieldAlert className={cn(cls, "text-danger")} />;
  if (type === "new_order") return <ShoppingBag className={cn(cls, "text-primary")} />;
  if (type === "review_submitted" || type === "seller_application_submitted" || type === "seller_product_submitted") return <Star className={cn(cls, "text-warning")} />;
  if (type === "order_update") return <PackageCheck className={cn(cls, "text-primary")} />;
  return <Info className={cn(cls, "text-muted-foreground")} />;
}

function ToastItem({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const step = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / TOAST_DURATION) * 100);
      setProgress(pct);
      if (pct > 0) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const isAlert = toast.type === "review_flagged" || toast.type === "sentra_alert" || toast.type === "product_rejected";

  return (
    <div
      className={cn(
        "relative w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border bg-card shadow-[0_8px_32px_rgba(0,0,0,0.28)] transition-all duration-300",
        toast.dismissing ? "translate-x-8 opacity-0" : "translate-x-0 opacity-100",
        isAlert ? "border-danger/30" : "border-border",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={cn("mt-0.5 grid size-8 flex-shrink-0 place-items-center rounded-lg", isAlert ? "bg-danger/12" : "bg-primary/10")}>
          <ToastIcon type={toast.type} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{toast.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{toast.message}</p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {toast.category === "admin" ? "Sentra Admin" : toast.category === "seller" ? "Seller Studio" : "NovaMart"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(toast.id)}
          className="mt-0.5 grid size-6 flex-shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="h-0.5 bg-muted">
        <div
          className={cn("h-full transition-none", isAlert ? "bg-danger" : "bg-primary")}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: string) => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed bottom-20 right-3 z-[300] flex flex-col-reverse gap-2 md:bottom-5 md:right-5">
      {toasts.slice(0, MAX_TOASTS).map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = "novamart-notifications";
const MAX_STORED = 60;

function loadFromStorage(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveToStorage(notifications: AppNotification[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED)));
  } catch { /* ignore */ }
}

function fromDbNotification(row: DbNotification): AppNotification {
  return {
    id: row.id,
    category: row.category,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
    href: row.href || undefined,
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const profileId = profile?.id;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t)));
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  }, []);

  // Hydrate from localStorage as a fallback before authenticated realtime loads.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNotifications(loadFromStorage());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!profileId || !supabase) return;
    const client = supabase;
    let alive = true;
    client
      .from("notifications")
      .select("id, profile_id, category, type, title, message, href, read, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(MAX_STORED)
      .then(({ data }) => {
        if (!alive) return;
        const next = ((data || []) as DbNotification[]).map(fromDbNotification);
        setNotifications(next);
        saveToStorage(next);
      });

    const channel = client
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${profileId}` },
        (payload) => {
          const notification = fromDbNotification(payload.new as DbNotification);
          setNotifications((prev) => {
            if (prev.some((item) => item.id === notification.id)) return prev;
            const next = [notification, ...prev].slice(0, MAX_STORED);
            saveToStorage(next);
            return next;
          });
          setToasts((prev) => [{ ...notification, dismissing: false }, ...prev].slice(0, MAX_TOASTS + 2));
          window.setTimeout(() => toastTone(notification.type, notification.category), 80);
          window.setTimeout(() => dismissToast(notification.id), TOAST_DURATION);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `profile_id=eq.${profileId}` },
        (payload) => {
          const notification = fromDbNotification(payload.new as DbNotification);
          setNotifications((prev) => {
            const next = prev.map((item) => (item.id === notification.id ? notification : item));
            saveToStorage(next);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void client.removeChannel(channel);
    };
  }, [dismissToast, profileId]);

  const notify = useCallback((input: NotificationInput) => {
    const notification: AppNotification = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };

    setNotifications((prev) => {
      const next = [notification, ...prev].slice(0, MAX_STORED);
      saveToStorage(next);
      return next;
    });

    setToasts((prev) => {
      const entry: ToastEntry = { ...notification, dismissing: false };
      return [entry, ...prev].slice(0, MAX_TOASTS + 2);
    });

    // Play sound after short delay so it doesn't overlap with UI render.
    window.setTimeout(() => toastTone(notification.type, notification.category), 80);

    // Auto-dismiss toast.
    const toastId = notification.id;
    window.setTimeout(() => dismissToast(toastId), TOAST_DURATION);
  }, [dismissToast]);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveToStorage(next);
      return next;
    });
    if (supabase) {
      void supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", id);
    }
  }, []);

  const markAllRead = useCallback((category: NotificationCategory) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.category === category ? { ...n, read: true } : n));
      saveToStorage(next);
      return next;
    });
    if (supabase && profileId) {
      void supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .eq("category", category)
        .eq("read", false);
    }
  }, [profileId]);

  const clear = useCallback((category: NotificationCategory) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.category !== category);
      saveToStorage(next);
      return next;
    });
  }, []);

  const unreadCount = useCallback(
    (category: NotificationCategory) => notifications.filter((n) => n.category === category && !n.read).length,
    [notifications],
  );

  return (
    <NotificationContext.Provider value={{ notifications, notify, markRead, markAllRead, clear, unreadCount }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
}

// ─── Notification icon helper (exported for bell) ─────────────────────────────

export function NotifIcon({ type, className }: { type: NotificationType; className?: string }) {
  const cls = cn("size-4", className);
  if (type === "order_placed" || type === "product_approved") return <CheckCircle2 className={cn(cls, "text-success")} />;
  if (type === "review_flagged" || type === "sentra_alert" || type === "seller_application_submitted" || type === "seller_product_submitted") return <AlertTriangle className={cn(cls, "text-warning")} />;
  if (type === "product_rejected" || type === "seller_application_rejected") return <ShieldAlert className={cn(cls, "text-danger")} />;
  if (type === "new_order") return <ShoppingBag className={cn(cls, "text-primary")} />;
  if (type === "review_submitted") return <Star className={cn(cls, "text-warning")} />;
  if (type === "order_update") return <PackageCheck className={cn(cls, "text-primary")} />;
  return <Info className={cn(cls, "text-muted-foreground")} />;
}
