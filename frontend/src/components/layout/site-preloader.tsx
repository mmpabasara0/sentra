"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const MIN_VISIBLE_MS = 4000;
const PRELOADER_KEY = "novamart-preloader-seen";

export function SitePreloader() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [readyToHide, setReadyToHide] = useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [isCleaned, setIsCleaned] = useState(false);
  const [lottieStarted, setLottieStarted] = useState(false);

  useEffect(() => {
    let hasSeen = false;
    try {
      hasSeen = window.sessionStorage.getItem(PRELOADER_KEY) === "1";
    } catch {
      // Ignore
    }

    // Never preloader if we have an active auth callback flow via url hash
    const isAuthCallback = window.location.hash.includes("access_token=") || window.location.hash.includes("error=");

    if (pathname !== "/" || hasSeen || isAuthCallback) {
      document.documentElement.removeAttribute("data-preloader");
      const cleanImmediately = window.setTimeout(() => setIsCleaned(true), 0);
      return () => window.clearTimeout(cleanImmediately);
    }

    const resetStatesTimer = window.setTimeout(() => {
      setIsCleaned(false);
      setReadyToHide(false);
      setPageLoaded(false);
    }, 0);

    document.documentElement.dataset.preloader = "pending";

    const activateTimer = window.setTimeout(() => {
      setActive(true);
      setLottieStarted(true);
    }, 10);
    const minTimer = window.setTimeout(() => setReadyToHide(true), MIN_VISIBLE_MS);

    const markLoaded = () => {
      setPageLoaded(true);
      try {
        window.sessionStorage.setItem(PRELOADER_KEY, "1");
      } catch {}
    };

    if (document.readyState === "complete") {
      window.setTimeout(markLoaded, 100);
    } else {
      window.addEventListener("load", markLoaded, { once: true });
    }

    return () => {
      window.clearTimeout(resetStatesTimer);
      window.clearTimeout(activateTimer);
      window.clearTimeout(minTimer);
      window.removeEventListener("load", markLoaded);
    };
  }, [pathname]);

  useEffect(() => {
    if (!active || !readyToHide || !pageLoaded) {
      return;
    }

    // 1. Remove the body hiding CSS instantly so main content can be seen
    // 2. Remove .is-active instantly so the preloader fades OUT
    document.documentElement.removeAttribute("data-preloader");
    const deactivateTimer = window.setTimeout(() => setActive(false), 0);

    // 3. Unmount from DOM after transition completes
    const cleanTimer = window.setTimeout(() => {
      setIsCleaned(true);
    }, 400);

    return () => {
      window.clearTimeout(deactivateTimer);
      window.clearTimeout(cleanTimer);
    };
  }, [active, readyToHide, pageLoaded]);

  if (isCleaned) return null;

  return (
    <div className={`preloader-root${active ? " is-active" : ""}`} aria-hidden={!active}>
      <div className="preloader-overlay">
        <div className="preloader-panel">
          <div className="preloader-glow" />
          <div className="preloader-lottie-wrap">
            {lottieStarted ? (
              <DotLottieReact
                src="https://lottie.host/0eac9a82-86d5-42f0-b286-e868184fc05b/xqeIgWqYcy.lottie"
                loop
                autoplay
              />
            ) : (
              <div className="preloader-fallback-orb" />
            )}
          </div>
          <div className="preloader-copy">
            <p className="preloader-kicker">NovaMart</p>
            <h2>Loading your storefront</h2>
            <p>Curated picks, smoother checkout, and a cleaner shopping flow are on the way.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
