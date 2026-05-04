"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { Product } from "@/lib/types";
import { api } from "@/services/api";
import { useAuth } from "@/context/auth-context";

export type CartItem = {
  id: string;
  quantity: number;
  products: Product;
};

type CartContextValue = {
  items: CartItem[];
  totalCount: number;
  totalAmount: number;
  open: boolean;
  loading: boolean;
  busyItemId: string;
  notice: string;
  lastAdded: Product | null;
  setOpen: (open: boolean) => void;
  refreshCart: (options?: { silent?: boolean }) => Promise<void>;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearNotice: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { token, session } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyItemId, setBusyItemId] = useState("");
  const [notice, setNotice] = useState("");
  const [lastAdded, setLastAdded] = useState<Product | null>(null);

  const totalCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.products.price) * item.quantity, 0),
    [items],
  );

  async function refreshCart(options: { silent?: boolean } = {}) {
    if (!token) {
      setItems([]);
      return;
    }
    if (!options.silent) {
      setLoading(true);
    }
    try {
      const data = await api.get<{ items: CartItem[] }>("/cart", token);
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshCart();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function addItem(product: Product, quantity = 1) {
    setOpen(true);
    setLastAdded(product);
    setNotice("");

    if (!session || !token) {
      setNotice("Sign in to keep this item in your cart and checkout.");
      return;
    }

    const tempId = `pending-${product.id}`;
    setItems((current) => {
      const existing = current.find((item) => item.products.id === product.id);
      if (existing) {
        return current.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [{ id: tempId, quantity, products: product }, ...current];
    });

    try {
      await api.post("/cart/items", { product_id: product.id, quantity }, token);
      await refreshCart({ silent: true });
    } catch (err) {
      await refreshCart({ silent: true });
      setNotice(err instanceof Error ? err.message : "Could not add this product to cart.");
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (!token) return;
    const safeQuantity = Math.max(1, quantity);
    setBusyItemId(itemId);
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, quantity: safeQuantity } : item));
    try {
      await api.put(`/cart/items/${itemId}`, { quantity: safeQuantity }, token);
      await refreshCart({ silent: true });
    } catch {
      await refreshCart({ silent: true });
    } finally {
      setBusyItemId("");
    }
  }

  async function removeItem(itemId: string) {
    if (!token) return;
    setBusyItemId(itemId);
    const previousItems = items;
    setItems((current) => current.filter((item) => item.id !== itemId));
    try {
      await api.delete(`/cart/items/${itemId}`, token);
      await refreshCart({ silent: true });
    } catch {
      setItems(previousItems);
    } finally {
      setBusyItemId("");
    }
  }

  return (
    <CartContext.Provider
      value={{
        items,
        totalCount,
        totalAmount,
        open,
        loading,
        busyItemId,
        notice,
        lastAdded,
        setOpen,
        refreshCart,
        addItem,
        updateQuantity,
        removeItem,
        clearNotice: () => setNotice(""),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}
