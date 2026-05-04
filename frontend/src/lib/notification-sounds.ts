// Web Audio API notification sounds — no external files needed.
// AudioContext is created lazily on first use (browser policy).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  audioCtx: AudioContext,
  freq: number,
  gain: number,
  start: number,
  duration: number,
  type: OscillatorType = "sine",
) {
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(gain, start);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Soft two-note ding for customer notifications. */
export function playCustomerSound() {
  const a = getCtx();
  if (!a) return;
  try {
    const t = a.currentTime;
    tone(a, 880, 0.16, t, 0.22);
    tone(a, 1100, 0.11, t + 0.14, 0.18);
  } catch { /* ignore */ }
}

/** Crisp double-beep for seller notifications. */
export function playSellerSound() {
  const a = getCtx();
  if (!a) return;
  try {
    const t = a.currentTime;
    tone(a, 660, 0.2, t, 0.14);
    tone(a, 880, 0.2, t + 0.18, 0.14);
  } catch { /* ignore */ }
}

/** Sharper alert pattern for admin queue events. */
export function playAdminSound() {
  const a = getCtx();
  if (!a) return;
  try {
    const t = a.currentTime;
    tone(a, 740, 0.18, t, 0.1, "square");
    tone(a, 988, 0.16, t + 0.14, 0.12, "square");
    tone(a, 740, 0.12, t + 0.3, 0.1, "square");
  } catch { /* ignore */ }
}

/** Warm success chord for confirmations (order placed, product approved). */
export function playSuccessSound() {
  const a = getCtx();
  if (!a) return;
  try {
    const t = a.currentTime;
    tone(a, 523, 0.14, t, 0.3);
    tone(a, 659, 0.12, t + 0.06, 0.28);
    tone(a, 784, 0.1, t + 0.12, 0.26);
  } catch { /* ignore */ }
}
