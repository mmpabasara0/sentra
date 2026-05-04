const STORAGE_KEY = "sentra-device-id";

function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const out = ((h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0"));
  return out;
}

function buildSignals(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "ssr";
  const screen = window.screen;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const langs = (navigator.languages || [navigator.language || ""]).join(",");
  return [
    navigator.userAgent || "",
    navigator.platform || "",
    `${screen?.width || 0}x${screen?.height || 0}x${screen?.colorDepth || 0}`,
    `dpr:${window.devicePixelRatio || 1}`,
    `tz:${tz}`,
    `lang:${langs}`,
    `hwc:${(navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency || 0}`,
  ].join("|");
}

export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (cached && cached.length >= 16) return cached;
  } catch {
    // localStorage unavailable; fall through to compute volatile fingerprint
  }
  const fp = hashString(buildSignals());
  try {
    window.localStorage.setItem(STORAGE_KEY, fp);
  } catch {
    // ignore storage failures
  }
  return fp;
}
