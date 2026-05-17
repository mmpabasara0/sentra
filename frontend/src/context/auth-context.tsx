"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";

import type { Profile } from "@/lib/types";
import { api } from "@/services/api";
import { isSupabaseConfigured, supabase } from "@/services/supabase";

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  token: string | undefined;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<{ confirmationRequired: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: (nextToken?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
export const PENDING_PROFILE_KEY = "novamart-pending-profile";

type PendingProfile = {
  full_name: string;
  username: string;
};

async function fetchProfileWithRetry(
  accessToken: string,
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>,
  setSession: React.Dispatch<React.SetStateAction<Session | null>>,
  allowRetry = true,
) {
  try {
    const data = await api.get<{ profile: Profile }>("/auth/me", accessToken);
    if (data.profile) {
      setProfile(data.profile);
      return data.profile;
    }

    const synced = await api.post<{ profile: Profile }>("/auth/sync-profile", {}, accessToken);
    setProfile(synced.profile);
    return synced.profile;
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (status === 403) {
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      return null;
    }
    if (status === 401 && allowRetry && supabase) {
      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshedData.session?.access_token) {
        setSession(refreshedData.session);
        return fetchProfileWithRetry(refreshedData.session.access_token, setProfile, setSession, false);
      }
      setSession(null);
    }
    setProfile(null);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const token = session?.access_token;

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setLoading(false);
      const nextToken = data.session?.access_token;
      if (nextToken) {
        await fetchProfileWithRetry(nextToken, setProfile, setSession);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setProfile(null);
      const nextToken = nextSession?.access_token;
      if (nextToken) {
        await fetchProfileWithRetry(nextToken, setProfile, setSession);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function refreshProfile(nextToken = token) {
    if (!nextToken) return;
    await fetchProfileWithRetry(nextToken, setProfile, setSession);
  }

  async function syncPendingProfile(nextToken: string) {
    const rawPendingProfile = window.localStorage.getItem(PENDING_PROFILE_KEY);
    if (!rawPendingProfile) return;

    try {
      const pendingProfile = JSON.parse(rawPendingProfile) as PendingProfile;
      const synced = await api.post<{ profile: Profile }>("/auth/sync-profile", pendingProfile, nextToken);
      setProfile(synced.profile);
      window.localStorage.removeItem(PENDING_PROFILE_KEY);
    } catch {
      // Keep the pending profile locally so we can retry after the next confirmed login.
    }
  }

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session?.access_token) {
      setSession(data.session);
      const nextProfile = await fetchProfileWithRetry(data.session.access_token, setProfile, setSession);
      if (!nextProfile) {
        throw new Error("This account has been restricted by an administrator.");
      }
      await syncPendingProfile(data.session.access_token);
    }
  }

  async function signUp(email: string, password: string, fullName: string, username: string) {
    if (!supabase) throw new Error("Supabase is not configured.");
    let data;
    const { data: suData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/register`,
        data: { full_name: fullName, username },
      },
    });
    
    if (error) {
      if (error.status === 429 || error.message.toLowerCase().includes("rate limit")) {
        console.warn("Email rate limit hit. Falling back to backend for link generation...");
        // Fallback to backend admin signup
        const res = await api.post<{ action_link?: string }>("/auth/admin-signup", { email, password, fullName, username });
        if (res.action_link) {
          console.log(`\n\n🚨 ACTIVATION LINK FOR ${email}:\n${res.action_link}\n\n`);
        }
        
        window.localStorage.setItem(
          PENDING_PROFILE_KEY,
          JSON.stringify({ full_name: fullName, username }),
        );
        return { confirmationRequired: true };
      }
      throw error;
    }
    
    data = suData;

    window.localStorage.setItem(
      PENDING_PROFILE_KEY,
      JSON.stringify({ full_name: fullName, username }),
    );

    const emailConfirmed = Boolean(data.user?.email_confirmed_at);
    if (!emailConfirmed) {
      if (data.session) {
        await supabase.auth.signOut();
      }
      setSession(null);
      setProfile(null);
      return { confirmationRequired: true };
    }

    const accessToken = data.session?.access_token;
    if (accessToken) {
      const synced = await api.post<{ profile: Profile }>("/auth/sync-profile", { full_name: fullName, username }, accessToken);
      setProfile(synced.profile);
      setSession(data.session);
      window.localStorage.removeItem(PENDING_PROFILE_KEY);
      return { confirmationRequired: false };
    }
    return { confirmationRequired: true };
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, token, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
