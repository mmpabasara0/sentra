"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

export function Breadcrumb() {
  const pathname = usePathname();

  // Generate breadcrumb items from pathname
  const rawSegments = pathname
    .split("/")
    .filter((s) => s && s !== "[id]");
  const segments =
    rawSegments[0] === "seller" && rawSegments[1] === "dashboard"
      ? ["seller"]
      : rawSegments;

  // Map segment to display label
  const breadcrumbMap: Record<string, string> = {
    seller: "Dashboard",
    dashboard: "Dashboard",
    products: "Products",
    orders: "Orders",
    reviews: "Reviews",
    profile: "Profile",
    admin: "Admin",
    users: "Users",
    sellers: "Sellers",
    moderation: "Moderation",
    "moderation-logs": "Moderation Logs",
    anomalies: "Anomalies",
  };

  const items = segments.map((segment, index) => {
    const isSellerRoot = segment === "seller" && index === 0;
    return {
      label: breadcrumbMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
      path: isSellerRoot ? "/seller/dashboard" : "/" + segments.slice(0, index + 1).join("/"),
      isLast: index === segments.length - 1,
    };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 border-b border-border bg-muted/20 px-5 py-3 text-sm text-muted-foreground"
    >
      <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="size-4" />
        <span>Home</span>
      </Link>
      {items.map((item) => (
        <div key={item.path} className="flex items-center gap-2">
          <ChevronRight className="size-4 text-border" />
          {item.isLast ? (
            <span className="font-semibold text-foreground">{item.label}</span>
          ) : (
            <Link href={item.path} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
