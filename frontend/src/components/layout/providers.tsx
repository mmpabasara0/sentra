"use client";

import { AuthProvider } from "@/context/auth-context";
import { CartProvider } from "@/context/cart-context";
import { NotificationProvider } from "@/context/notification-context";
import { SitePreloader } from "@/components/layout/site-preloader";
import { AuthCallbackOverlay } from "@/components/layout/auth-callback-overlay";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <SitePreloader />
          <AuthCallbackOverlay />
          {children}
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}
