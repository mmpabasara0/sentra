"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ClipboardList,
  Fingerprint,
  FlaskConical,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Sun,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (window.localStorage.getItem("novamart-theme") as "dark" | "light" | null) || "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("novamart-theme", nextTheme);
    document.documentElement.classList.toggle("light", nextTheme === "light");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="grid size-10 place-items-center rounded-md border border-border bg-card/70 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function AccountMenu() {
  const { profile, session, signOut, loading, refreshProfile, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<"seller" | "customer" | null>(null);
  // Track if user has an active seller record (separate from profile role cache)
  const [hasSellerRecord, setHasSellerRecord] = useState<boolean | null>(null);
  const didCheckSeller = useRef(false);

  const isAdmin = profile?.role === "admin";
  // isSeller: profile role OR confirmed active seller record
  const isSeller = profile?.role === "seller" || hasSellerRecord === true;
  const isOnSellerPages = pathname.startsWith("/seller");

  // Check seller status as soon as we have a token (not just on dropdown open)
  // so the "Switch to seller" option is already visible when the dropdown opens.
  useEffect(() => {
    if (!token || didCheckSeller.current) return;
    didCheckSeller.current = true;
    api.get<{ seller: { status: string } | null }>("/seller/me", token)
      .then((data) => {
        setHasSellerRecord(data.seller?.status === "active");
      })
      .catch(() => { /* ignore */ });
  }, [token]);

  // On open, also refresh the profile to pick up any role changes
  const handleOpen = useCallback(async () => {
    setOpen((prev) => {
      if (!prev && token) {
        void refreshProfile();
      }
      return !prev;
    });
  }, [token, refreshProfile]);

  if (loading) {
    return <div className="hidden h-10 w-28 rounded-md bg-muted/70 shimmer sm:block" />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="hidden sm:block">
          <Button variant="ghost">Sign in</Button>
        </Link>
        <Link href="/register">
          <Button>Create account</Button>
        </Link>
      </div>
    );
  }

  const accountName = profile?.full_name || profile?.username || session.user.user_metadata?.full_name || session.user.user_metadata?.username || session.user.email || "NovaMart User";
  const usernameLabel = profile?.username || session.user.user_metadata?.username || session.user.email?.split("@")[0] || "Account";
  const emailLabel = profile?.email || session.user.email || "Email not available";

  const initials = accountName
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function switchWorkspace(mode: "seller" | "customer") {
    setOpen(false);
    setSwitching(mode);
    window.setTimeout(() => {
      router.push(mode === "seller" ? "/seller/dashboard" : "/dashboard");
      window.setTimeout(() => setSwitching(null), 360);
    }, 620);
  }

  // Determine what seller-related action to show:
  // Admin users who are also sellers can still switch modes.
  // - Seller on seller pages: show "Switch to customer"
  // - Seller on customer pages: show "Switch to seller"
  // - Non-seller (and non-admin): show "Become a seller" link
  const showSwitchToCustomer = isSeller && isOnSellerPages;
  const showSwitchToSeller = isSeller && !isOnSellerPages;
  const showBecomeASeller = !isAdmin && !isSeller;

  const roleLabel = isAdmin && isSeller
    ? "Admin & Seller account"
    : isAdmin
    ? "Admin account"
    : isSeller
    ? "Seller account"
    : "NovaMart account";

  return (
    <div className="relative">
      {typeof document !== "undefined" && switching
        ? createPortal(
            <div className="fixed inset-0 z-[250] grid place-items-center bg-background/94 backdrop-blur-2xl">
              <div className="relative grid w-[min(420px,calc(100vw-32px))] gap-5 overflow-hidden rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
                <div className="absolute inset-x-8 top-0 h-px bg-primary/70" />
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/14 text-primary">
                  {switching === "seller" ? <Store className="size-7" /> : <ShoppingBag className="size-7" />}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Switching workspace</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                    Opening {switching === "seller" ? "seller studio" : "customer account"}
                  </h2>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="seller-switch-progress h-full rounded-full bg-primary" />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <button
        type="button"
        onClick={handleOpen}
        className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-card/70 px-2 py-1 hover:bg-muted"
      >
        <span className="grid size-8 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          {initials}
        </span>
        <span className="hidden max-w-28 truncate text-sm font-semibold sm:inline">{usernameLabel}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
          {/* Identity header */}
          <div className="border-b border-border p-4">
            <p className="font-semibold">{accountName}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{emailLabel}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {isAdmin ? <ShieldCheck className="size-3" /> : isSeller ? <Store className="size-3" /> : <UserRound className="size-3" />}
              {roleLabel}
            </span>
          </div>

          {/* Main menu items */}
          <div className="grid p-2 text-sm">
            <Link
              className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-muted"
              href="/profile"
              onClick={() => setOpen(false)}
            >
              <UserRound className="size-4 text-muted-foreground" />
              Profile
            </Link>
            <Link
              className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-muted"
              href="/orders"
              onClick={() => setOpen(false)}
            >
              <ClipboardList className="size-4 text-muted-foreground" />
              Orders
            </Link>
            <Link
              className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-muted"
              href="/dashboard"
              onClick={() => setOpen(false)}
            >
              <LayoutDashboard className="size-4 text-muted-foreground" />
              Account dashboard
            </Link>

            {/* Seller workspace toggle */}
            {showSwitchToSeller ? (
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-primary hover:bg-primary/10"
                onClick={() => switchWorkspace("seller")}
              >
                <Store className="size-4" />
                Switch to seller
              </button>
            ) : null}
            {showSwitchToCustomer ? (
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left hover:bg-muted"
                onClick={() => switchWorkspace("customer")}
              >
                <ShoppingBag className="size-4 text-muted-foreground" />
                Switch to customer
              </button>
            ) : null}
            {showBecomeASeller ? (
              <Link
                className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-muted"
                href="/seller/apply"
                onClick={() => setOpen(false)}
              >
                <Store className="size-4 text-muted-foreground" />
                Become a seller
              </Link>
            ) : null}

            {/* Admin section — visually separated */}
            {isAdmin ? (
              <>
                <div className="my-1.5 mx-1 border-t border-border" />
                <div className="mb-1 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                  Admin
                </div>
                <Link
                  className="flex items-center gap-2.5 rounded-md bg-amber-500/8 px-3 py-2 font-medium text-amber-500 hover:bg-amber-500/15"
                  href="/admin/dashboard"
                  onClick={() => setOpen(false)}
                >
                  <ShieldCheck className="size-4" />
                  Admin dashboard
                </Link>
              </>
            ) : null}

            <div className="my-1.5 mx-1 border-t border-border" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-danger hover:bg-danger/10"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Nav() {
  const pathname = usePathname();
  const isSeller = pathname.startsWith("/seller");
  const isCustomerWorkspace = pathname === "/dashboard" || pathname === "/orders" || pathname === "/profile";
  const { session } = useAuth();
  const { totalCount, setOpen } = useCart();
  const isAuthenticated = Boolean(session);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPromoDismissed(window.sessionStorage.getItem("novamart-promo-dismissed") === "1");
  }, []);

  const dismissPromo = () => {
    setPromoDismissed(true);
    window.sessionStorage.setItem("novamart-promo-dismissed", "1");
  };

  const navLinks = useMemo(
    () => {
      if (isSeller || isCustomerWorkspace) return [];
      const links = [{ href: "/products", label: "Shop" }];
      if (isAuthenticated) {
        links.push({ href: "/orders", label: "Orders" });
        links.push({ href: "/dashboard", label: "Dashboard" });
      }
      return links;
    },
    [isAuthenticated, isCustomerWorkspace, isSeller],
  );

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/86 backdrop-blur-xl">
      {!isSeller && !isCustomerWorkspace && !promoDismissed && (
        <div className="bg-primary text-primary-foreground relative">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-4 px-4 py-2 text-xs font-semibold sm:justify-between">
            <span>Free delivery on orders over LKR 5,000</span>
            <span className="hidden sm:inline text-center">Weekend deals end Sunday night</span>
            <button aria-label="Dismiss promo" onClick={dismissPromo} className="absolute right-2 top-1.5 grid size-6 place-items-center rounded-sm hover:bg-primary-foreground/20">
               <X className="size-3" />
            </button>
          </div>
        </div>
      )}
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center gap-3 px-4 py-3",
          (isSeller || isCustomerWorkspace) && "mx-0 max-w-none px-4 md:px-5 xl:px-6",
        )}
      >
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="grid size-10 place-items-center rounded-md border border-border bg-card/70 md:hidden"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground shadow-[0_16px_38px_-24px_var(--primary)]">
            <ShoppingBag className="size-5" />
          </span>
          <span className="text-lg">NovaMart</span>
        </Link>
        
        {!isSeller ? (
          <form
            action="/products"
            className={cn(
              "hidden min-w-0 flex-1 items-center gap-2 md:flex",
              isCustomerWorkspace ? "md:max-w-2xl lg:max-w-3xl" : "md:max-w-md lg:max-w-lg xl:max-w-xl",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center rounded-md border border-border bg-card/70 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <Search className="size-4 text-muted-foreground" />
              <input
                aria-label="Search products"
                name="q"
                placeholder="Search earbuds, mugs, backpacks..."
                className="min-h-10 flex-1 border-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Link href="/products?filters=1" className={cn("hidden lg:block", isCustomerWorkspace && "hidden xl:block")}>
              <Button variant="secondary" type="button">
                <SlidersHorizontal className="size-4" /> Filters
              </Button>
            </Link>
          </form>
        ) : (
          <div className="hidden min-w-0 flex-1 md:flex"></div>
        )}

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                pathname === link.href && "bg-muted text-foreground",
              )}
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={cn("ml-auto flex items-center gap-2", isSeller && "mt-1")}>
          <ThemeToggle />
          {!isSeller && (
            <>
              <NotificationBell category="customer" />
              <button
                type="button"
                aria-label="Open cart"
                onClick={() => setOpen(true)}
                className="relative grid size-10 place-items-center rounded-md border border-border bg-card/70 hover:bg-muted"
              >
                <ShoppingCart className="size-4" />
                <span key={totalCount} className="cart-count-badge absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {totalCount}
                </span>
              </button>
            </>
          )}
          {isSeller && <NotificationBell category="seller" />}
          <AccountMenu />
        </div>
      </div>
      {!isSeller ? (
        <div className="border-t border-border/70 px-4 pb-3 md:hidden">
          <form action="/products" className="flex items-center rounded-md border border-border bg-card/70 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <Search className="size-4 text-muted-foreground" />
            <input
              aria-label="Search products"
              name="q"
              placeholder="Search products, orders, categories..."
              className="min-h-10 flex-1 border-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </form>
        </div>
      ) : null}
      {mobileOpen ? (
        <div className="fixed inset-0 z-30 bg-background/88 backdrop-blur md:hidden">
          <div className="m-3 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Menu</span>
              <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center rounded-md hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="rounded-md bg-muted/60 px-3 py-3 font-medium">
                  {link.label}
                </Link>
              ))}
              <Link href="/cart" onClick={() => setMobileOpen(false)} className="rounded-md bg-muted/60 px-3 py-3 font-medium">Cart</Link>
              {isAuthenticated && <Link href="/profile" onClick={() => setMobileOpen(false)} className="rounded-md bg-muted/60 px-3 py-3 font-medium">Profile</Link>}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

const SELLER_NAV = [
  { href: "/seller/dashboard", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/seller/products", label: "Products", Icon: PackageCheck, exact: false },
  { href: "/seller/orders", label: "Orders", Icon: ShoppingBag, exact: true },
  { href: "/seller/reviews", label: "Reviews", Icon: Star, exact: true },
] as const;

const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/admin/reviews", label: "Reviews", Icon: ShieldCheck, exact: false },
  { href: "/admin/sellers", label: "Sellers", Icon: Store, exact: false },
  { href: "/admin/products", label: "Products", Icon: PackageSearch, exact: false },
  { href: "/admin/users", label: "Users", Icon: UsersRound, exact: false },
  { href: "/admin/anomalies", label: "Anomalies", Icon: AlertTriangle, exact: false },
  { href: "/admin/fraud", label: "Fraud signals", Icon: Fingerprint, exact: false },
  { href: "/admin/moderation-logs", label: "Audit log", Icon: Activity, exact: false },
  { href: "/admin/tester", label: "Sentra tester", Icon: FlaskConical, exact: false },
] as const;

function AdminNavList({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  return (
    <div className="grid gap-0.5">
      {ADMIN_NAV.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/14 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function AdminTopbar() {
  const { profile, session, signOut } = useAuth();
  const initials = (profile?.full_name || profile?.username || session?.user?.email || "A")
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/86 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2 font-semibold tracking-tight">
        <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground shadow-[0_16px_38px_-24px_var(--primary)]">
          <ShieldCheck className="size-4" />
        </span>
        <div className="leading-tight">
          <span className="block text-sm">Sentra</span>
          <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Admin console
          </span>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell category="admin" />
        <Link
          href="/dashboard"
          className="hidden items-center gap-2 rounded-md border border-border bg-card/70 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
        >
          <ShoppingBag className="size-3.5" /> Exit to NovaMart
        </Link>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card/70 px-2 py-1.5">
          <span className="grid size-7 place-items-center rounded bg-primary text-[11px] font-bold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden text-xs font-semibold sm:inline">
            {profile?.username || profile?.full_name || "Admin"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Sign out"
          className="grid size-9 place-items-center rounded-md border border-border bg-card/70 text-muted-foreground hover:bg-danger/10 hover:text-danger"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}

function AdminWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AdminTopbar />
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-60 shrink-0 flex-col border-r border-border bg-card/40 p-3 md:flex">
          <p className="mb-3 mt-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Command center
          </p>
          <AdminNavList pathname={pathname} />
          <div className="mt-auto rounded-lg border border-primary/20 bg-primary/6 p-3">
            <p className="text-xs font-semibold">Sentra engine v1</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Rule-based scoring with explainable risk reasons across reviews, users, sellers and product listings.
            </p>
          </div>
        </aside>

        {/* Mobile open button */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-5 right-5 z-30 grid size-12 place-items-center rounded-full border border-border bg-card text-foreground shadow-[var(--shadow-soft)] md:hidden"
          aria-label="Open admin menu"
        >
          <Menu className="size-5" />
        </button>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-card p-3 shadow-[var(--shadow-soft)]">
              <div className="mb-4 flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Command center
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </button>
              </div>
              <AdminNavList pathname={pathname} onClick={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSeller = pathname.startsWith("/seller");
  const isAdmin = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isCustomerWorkspace = pathname === "/dashboard" || pathname === "/orders" || pathname === "/profile";

  if (isAdmin) {
    return (
      <>
        <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-card focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-foreground focus-visible:shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:ring-primary">
          Skip to main content
        </a>
        <AdminWorkspace>{children}</AdminWorkspace>
      </>
    );
  }

  return (
    <>
      <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-card focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-foreground focus-visible:shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:ring-primary">
        Skip to main content
      </a>
      <Nav />
      <CartDrawer />
      {isSeller ? (
        <div className="flex w-full items-start pb-16 md:pb-0">
          {/* Desktop sidebar */}
          <aside className="sticky top-[64px] hidden min-h-[calc(100vh-64px)] w-48 flex-shrink-0 border-r border-border p-3 md:block">
            <div className="mb-4 mt-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Seller Menu
            </div>
            <div className="grid gap-1">
              {SELLER_NAV.map(({ href, label, Icon, exact }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted",
                    (exact ? pathname === href : pathname.startsWith(href)) &&
                      "bg-muted font-semibold text-primary",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </Link>
              ))}
            </div>
          </aside>
          <main id="main-content" className="min-w-0 flex-1">
            <Breadcrumb />
            {children}
          </main>
          {/* Mobile bottom tab bar */}
          <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background/94 backdrop-blur-xl md:hidden">
            {SELLER_NAV.map(({ href, label, Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : (
        <main id="main-content">{children}</main>
      )}
      {!isSeller && !isCustomerWorkspace ? (
        <footer className="border-t border-border bg-card/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1fr_1.3fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 font-semibold">
              <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
                <ShoppingBag className="size-4" />
              </span>
              NovaMart
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              Curated everyday products, quick checkout, and honest customer reviews.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Shop", "Products", "Deals", "New arrivals"],
              ["Support", "Delivery", "Returns", "Help center"],
              ["Account", "Orders", "Profile", "Wishlist"],
            ].map(([title, ...items]) => (
              <div key={title}>
                <h2 className="text-sm font-semibold">{title}</h2>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  {items.map((item) => (
                    <Link key={item} href="/products" className="hover:text-foreground">
                      {item}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border px-4 py-4">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 NovaMart. All rights reserved.</span>
            <span className="inline-flex items-center gap-4">
              <Link href="/products" className="hover:text-foreground">Privacy</Link>
              <Link href="/products" className="hover:text-foreground">Terms</Link>
              <Link href="/products" className="hover:text-foreground">Contact</Link>
            </span>
          </div>
        </div>
        </footer>
      ) : null}
    </>
  );
}

export function PageHeader({
  title,
  eyebrow,
  children,
  icon,
}: {
  title: string;
  eyebrow?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSeller = pathname.startsWith("/seller");

  return (
    <section className="border-b border-border bg-card/45">
      <div className={cn("mx-auto grid max-w-7xl gap-5 px-4 py-10 md:grid-cols-[1.4fr_0.8fr] md:items-end", isSeller && "mx-0 max-w-none px-5")}>
        <div className="reveal">
          {eyebrow ? (
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/55 px-3 py-1 text-xs font-semibold text-primary">
              {icon || <Sparkles className="size-3.5" />}
              {eyebrow}
            </p>
          ) : null}
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{title}</h1>
        </div>
        <div className="reveal text-sm leading-6 text-muted-foreground" style={{ "--delay": 1 } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </section>
  );
}

export const shellIcons = { Heart, LayoutDashboard, PackageCheck, UserRound };
