"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export function AuthCallbackOverlay() {
  const [state, setState] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash || !hash.includes("type=signup") && !hash.includes("error=")) return;

    const params = new URLSearchParams(hash.slice(1));
    const isSuccess = !!params.get("access_token");
    const isError = !!params.get("error");

    if (!isSuccess && !isError) return;

    let stateTimer: number | undefined;

    if (isSuccess) {
      if (params.get("type") === "signup" || params.get("type") === "recovery" || params.get("type") === "magiclink") {
        stateTimer = window.setTimeout(() => setState("success"), 0);
      }
    } else if (isError) {
      const nextErrorMessage = params.get("error_description")?.replace(/\+/g, " ") || "An error occurred during verification.";
      stateTimer = window.setTimeout(() => {
        setErrorMessage(nextErrorMessage);
        setState("error");
      }, 0);
    }

    const timer = setTimeout(() => {
      try { window.close(); } catch {}
      window.location.hash = "";
      setState("idle");
    }, 5000);

    return () => {
      if (stateTimer) window.clearTimeout(stateTimer);
      clearTimeout(timer);
    };
  }, []);

  if (state === "idle") return null;

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-background px-4">
      <div className="reveal mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card/80 p-8 text-center shadow-[var(--shadow-soft)] backdrop-blur-xl">
        {state === "success" ? (
          <>
            <div className="grid size-16 place-items-center rounded-full bg-success/15 text-success ring-8 ring-success/5">
              <CheckCircle2 className="size-8" />
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Account verified</h1>
            <p className="text-muted-foreground leading-relaxed">
              You have successfully verified your account.
              <br />
              This window will close automatically in 5 seconds.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Closing window...
            </div>
          </>
        ) : (
          <>
            <div className="grid size-16 place-items-center rounded-full bg-danger/15 text-danger ring-8 ring-danger/5">
              <AlertTriangle className="size-8" />
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Verification failed</h1>
            <p className="text-muted-foreground leading-relaxed">
              {errorMessage}
              <br />
              This window will close automatically in 5 seconds.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Closing window...
            </div>
          </>
        )}
      </div>
    </div>
  );
}
