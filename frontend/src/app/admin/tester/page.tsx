"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Fingerprint,
  FlaskConical,
  Play,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserRound,
  Zap,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { api } from "@/services/api";

type Flag = {
  category: string;
  rule_code: string;
  reason: string;
  score_impact: number;
};

type ReviewAnalysis = {
  risk_score: number;
  risk_label: string;
  status: string;
  category_scores: Record<string, number>;
  flags: Flag[];
};

type SellerAnalysis = {
  risk_score: number;
  risk_label: string;
  reasons: Flag[];
};

type ProductAnalysis = {
  risk_score: number;
  risk_label: string;
  reasons: Flag[];
};

type TrustAnalysis = {
  trust_score: number;
  trust_label: string;
  approved_reviews: number;
  flagged_reviews: number;
  rejected_reviews: number;
  quarantined_reviews: number;
};

type TargetProduct = {
  id: string;
  name: string;
  average_rating: number;
  category?: string;
  seller_name?: string;
};

type TargetProfile = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  status: string;
  created_at?: string;
  phone?: string;
  address?: string;
};

type Targets = {
  products: TargetProduct[];
  profiles: TargetProfile[];
};

type ReviewScenario = {
  rating: number;
  title: string;
  body: string;
  username: string;
  accountAgeHours: number;
  hasFullName: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  hasVerifiedPurchase: boolean;
  priorTrustScore: number;
  duplicateTextFromAnotherUser: boolean;
  reusedSameTextAcrossProducts: boolean;
  userReviewBurstCount: number;
  productReviewClusterCount: number;
  sharedDeviceAccounts: number;
  sharedIpAccounts: number;
  deviceReviewBurstCount: number;
  extremeRatingBurstCount: number;
  newAccountExtremeCount: number;
};

type ReviewSourceMode = "linked" | "custom";

type SellerScenario = {
  hasNic: boolean;
  hasUtilityBill: boolean;
  profileComplete: boolean;
  contactMismatch: boolean;
  storeName: string;
  reusedPayment: boolean;
  repeatedApplications: boolean;
};

type ProductScenario = {
  name: string;
  description: string;
  price: number;
  duplicateText: boolean;
  uploadBurstCount: number;
};

type TrustScenario = {
  accountAgeDays: number;
  completedFields: number;
  orders: number;
  approvedReviews: number;
  flaggedReviews: number;
  rejectedReviews: number;
  quarantinedReviews: number;
  categoryCount: number;
};

type ScenarioPack = {
  id: string;
  label: string;
  tone: "good" | "warn" | "bad";
  description: string;
  review: ReviewScenario;
  seller: SellerScenario;
  product: ProductScenario;
  trust: TrustScenario;
};

const MARKETING_WORDS = ["amazing", "perfect", "unbeatable", "premium", "guaranteed", "must buy", "life changing", "best ever"];
const GENERIC_REVIEWS = ["good product", "nice item", "best product ever", "very good", "excellent product", "highly recommended"];
const POSITIVE_WORDS = ["good", "great", "excellent", "perfect", "amazing", "love", "best"];
const NEGATIVE_WORDS = ["bad", "poor", "broken", "waste", "terrible", "hate", "awful"];
const PRAISE_LEXICON = ["good", "great", "super", "nice", "wow", "cool", "awesome", "amazing", "best", "love", "perfect", "excellent", "fantastic", "ok", "okay", "fine", "product", "item", "thing", "stuff"];

const PRESETS: ScenarioPack[] = [
  {
    id: "clean",
    label: "Clean buyer",
    tone: "good",
    description: "Normal customer behavior with a strong profile and useful review.",
    review: {
      rating: 4,
      title: "Solid build, smooth daily use",
      body: "I've been using this for about three weeks now. The build feels solid, the battery lasts a full day, and packaging arrived in good condition.",
      username: "nimal_perera",
      accountAgeHours: 2880,
      hasFullName: true,
      hasPhone: true,
      hasAddress: true,
      hasVerifiedPurchase: true,
      priorTrustScore: 84,
      duplicateTextFromAnotherUser: false,
      reusedSameTextAcrossProducts: false,
      userReviewBurstCount: 1,
      productReviewClusterCount: 2,
      sharedDeviceAccounts: 1,
      sharedIpAccounts: 1,
      deviceReviewBurstCount: 1,
      extremeRatingBurstCount: 1,
      newAccountExtremeCount: 0,
    },
    seller: {
      hasNic: true,
      hasUtilityBill: true,
      profileComplete: true,
      contactMismatch: false,
      storeName: "Lanka Craft House",
      reusedPayment: false,
      repeatedApplications: false,
    },
    product: {
      name: "Walnut desk lamp",
      description: "Hand-finished walnut desk lamp with warm LED output, stable metal base, and a braided cable suited for work desks and bedside tables.",
      price: 18450,
      duplicateText: false,
      uploadBurstCount: 1,
    },
    trust: {
      accountAgeDays: 180,
      completedFields: 4,
      orders: 5,
      approvedReviews: 6,
      flaggedReviews: 0,
      rejectedReviews: 0,
      quarantinedReviews: 0,
      categoryCount: 3,
    },
  },
  {
    id: "review-farm",
    label: "Multi-account review farm",
    tone: "bad",
    description: "Fresh accounts coordinate from one device and IP to push repeated five-star praise.",
    review: {
      rating: 5,
      title: "AMAZING MUST BUY",
      body: "Amazing amazing amazing best best best perfect product guaranteed must buy life changing!!! visit https://promo.example.com",
      username: "user94842",
      accountAgeHours: 8,
      hasFullName: false,
      hasPhone: false,
      hasAddress: false,
      hasVerifiedPurchase: false,
      priorTrustScore: 22,
      duplicateTextFromAnotherUser: true,
      reusedSameTextAcrossProducts: true,
      userReviewBurstCount: 6,
      productReviewClusterCount: 8,
      sharedDeviceAccounts: 4,
      sharedIpAccounts: 4,
      deviceReviewBurstCount: 4,
      extremeRatingBurstCount: 6,
      newAccountExtremeCount: 5,
    },
    seller: {
      hasNic: false,
      hasUtilityBill: false,
      profileComplete: false,
      contactMismatch: true,
      storeName: "Best Promo Official 9999",
      reusedPayment: true,
      repeatedApplications: true,
    },
    product: {
      name: "Mega power earbuds",
      description: "Amazing premium guaranteed must buy unbeatable perfect earbuds.",
      price: 149,
      duplicateText: true,
      uploadBurstCount: 7,
    },
    trust: {
      accountAgeDays: 0,
      completedFields: 1,
      orders: 0,
      approvedReviews: 0,
      flaggedReviews: 2,
      rejectedReviews: 1,
      quarantinedReviews: 2,
      categoryCount: 1,
    },
  },
  {
    id: "mismatch",
    label: "Sentiment mismatch",
    tone: "warn",
    description: "A suspicious rating mismatch from a new buyer without purchase history.",
    review: {
      rating: 5,
      title: "Five stars",
      body: "This was a complete waste of money. The build is broken, terrible quality, and customer support has been awful for two weeks straight.",
      username: "user7721",
      accountAgeHours: 36,
      hasFullName: true,
      hasPhone: false,
      hasAddress: false,
      hasVerifiedPurchase: false,
      priorTrustScore: 42,
      duplicateTextFromAnotherUser: false,
      reusedSameTextAcrossProducts: false,
      userReviewBurstCount: 2,
      productReviewClusterCount: 3,
      sharedDeviceAccounts: 1,
      sharedIpAccounts: 1,
      deviceReviewBurstCount: 1,
      extremeRatingBurstCount: 2,
      newAccountExtremeCount: 1,
    },
    seller: {
      hasNic: false,
      hasUtilityBill: true,
      profileComplete: false,
      contactMismatch: false,
      storeName: "Discount Home 5532",
      reusedPayment: false,
      repeatedApplications: false,
    },
    product: {
      name: "Portable speaker",
      description: "Compact speaker with Bluetooth connectivity and 8-hour playback for indoor use and short travel sessions.",
      price: 2990,
      duplicateText: false,
      uploadBurstCount: 2,
    },
    trust: {
      accountAgeDays: 2,
      completedFields: 2,
      orders: 0,
      approvedReviews: 1,
      flaggedReviews: 1,
      rejectedReviews: 0,
      quarantinedReviews: 0,
      categoryCount: 1,
    },
  },
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(text: string) {
  return normalize(text).match(/[a-zA-Z']+/g) || [];
}

function addFlag(list: Flag[], category: string, ruleCode: string, reason: string, scoreImpact: number) {
  list.push({ category, rule_code: ruleCode, reason, score_impact: scoreImpact });
}

function clamp(value: number, max: number) {
  return Math.min(value, max);
}

function toneForLabel(label: string): "good" | "warn" | "bad" | "neutral" {
  const value = label.toLowerCase();
  if (value.includes("high") || value.includes("risk") || value.includes("quarantined")) return "bad";
  if (value.includes("suspicious") || value.includes("moderate") || value.includes("needs")) return "warn";
  if (value.includes("genuine") || value.includes("trusted") || value.includes("strong") || value.includes("published")) return "good";
  return "neutral";
}

function scoreColor(score: number) {
  if (score >= 60) return "var(--danger)";
  if (score >= 30) return "var(--warning)";
  return "var(--success)";
}

function accountAgeDaysFromIso(iso?: string) {
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function trustLabel(score: number) {
  if (score >= 71) return "Trusted Reviewer";
  if (score >= 31) return "Moderate Risk Reviewer";
  return "High Risk Reviewer";
}

function sellerLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Needs Review";
  return "At Risk";
}

function productLabel(score: number) {
  if (score >= 60) return "High Risk";
  if (score >= 30) return "Suspicious";
  return "Genuine";
}

function classifyReview(score: number) {
  if (score >= 55) return { risk_label: "High Risk", status: "quarantined" };
  if (score >= 25) return { risk_label: "Suspicious", status: "flagged" };
  return { risk_label: "Genuine", status: "published" };
}

function simulateSeller(input: SellerScenario): SellerAnalysis {
  const reasons: Flag[] = [];
  if (!input.hasNic || !input.hasUtilityBill) addFlag(reasons, "Document Risk", "MISSING_REQUIRED_DOCUMENTS", "Required seller verification documents are missing.", 18);
  if (!input.profileComplete) addFlag(reasons, "Profile Risk", "INCOMPLETE_CUSTOMER_PROFILE", "Customer profile is incomplete before seller upgrade.", 10);
  if (input.contactMismatch) addFlag(reasons, "Profile Risk", "CONTACT_MISMATCH", "Seller phone number differs from customer profile phone.", 6);
  if (["official", "guaranteed", "cheap", "discount", "promo", "best"].some((word) => input.storeName.toLowerCase().includes(word))) {
    addFlag(reasons, "Store Risk", "SUSPICIOUS_STORE_NAME", "Store name uses promotional or trust-claim wording.", 8);
  }
  if (/^[a-z]+\d{4,}$/i.test(input.storeName.replace(/\s+/g, "").toLowerCase())) {
    addFlag(reasons, "Store Risk", "RANDOM_STORE_NAME", "Store name resembles a random generated account.", 8);
  }
  if (input.reusedPayment) addFlag(reasons, "Payment Risk", "REUSED_PAYMENT_DETAIL", "Payment account is used by another seller application.", 12);
  if (input.repeatedApplications) addFlag(reasons, "Behavior Risk", "REPEATED_APPLICATIONS", "Multiple seller applications were submitted recently.", 8);
  const score = Math.max(0, 100 - Math.min(100, reasons.reduce((sum, item) => sum + item.score_impact, 0)));
  return { risk_score: score, risk_label: sellerLabel(score), reasons };
}

function simulateProduct(input: ProductScenario): ProductAnalysis {
  const reasons: Flag[] = [];
  if (input.description.split(/\s+/).filter(Boolean).length < 8) addFlag(reasons, "Listing Risk", "SHORT_DESCRIPTION", "Product description is too short for review.", 9);
  if (MARKETING_WORDS.filter((word) => normalize(input.description).includes(word)).length >= 2) {
    addFlag(reasons, "Listing Risk", "MARKETING_HEAVY_LISTING", "Listing uses repeated promotional wording.", 10);
  }
  if (input.price <= 0) addFlag(reasons, "Listing Risk", "INVALID_PRICE", "Product price is not valid.", 25);
  else if (input.price < 250 || input.price > 500000) addFlag(reasons, "Listing Risk", "UNUSUAL_PRICE", "Product price is unusual for NovaMart catalog ranges.", 8);
  if (input.duplicateText) addFlag(reasons, "Listing Risk", "DUPLICATE_LISTING_TEXT", "Similar product text exists from another seller.", 12);
  if (input.uploadBurstCount >= 5) addFlag(reasons, "Behavior Risk", "SELLER_UPLOAD_BURST", "Seller submitted many products in a short time.", 12);
  const score = Math.min(100, reasons.reduce((sum, item) => sum + item.score_impact, 0));
  return { risk_score: score, risk_label: productLabel(score), reasons };
}

function simulateTrust(input: TrustScenario): TrustAnalysis {
  let score = 60;
  if (input.accountAgeDays >= 30) score += 12;
  else if (input.accountAgeDays < 3) score -= 12;
  score += input.completedFields * 3;
  score += Math.min(input.orders * 5, 15);
  score += Math.min(input.approvedReviews * 2, 10);
  score += Math.min(input.categoryCount * 3, 9);
  score -= input.flaggedReviews * 8;
  score -= input.rejectedReviews * 14;
  score -= input.quarantinedReviews * 18;
  const trustScore = Math.max(0, Math.min(100, score));
  return {
    trust_score: trustScore,
    trust_label: trustLabel(trustScore),
    approved_reviews: input.approvedReviews,
    flagged_reviews: input.flaggedReviews,
    rejected_reviews: input.rejectedReviews,
    quarantined_reviews: input.quarantinedReviews,
  };
}

function disabledSellerResult(): SellerAnalysis {
  return { risk_score: 100, risk_label: "Disabled", reasons: [] };
}

function disabledProductResult(): ProductAnalysis {
  return { risk_score: 0, risk_label: "Disabled", reasons: [] };
}

function RiskGauge({ score, label }: { score: number; label: string }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = scoreColor(score);
  return (
    <div className="grid place-items-center">
      <div className="relative size-36">
        <svg viewBox="0 0 100 100" className="size-36 -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 264} 264`} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-mono text-4xl font-semibold tracking-tight" style={{ color }}>{score}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, eyebrow, icon, children }: { title: string; eyebrow: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-card/70 p-5 shadow-[var(--shadow-soft)]">
      <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
        {icon}
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FlagList({ flags, empty }: { flags: Flag[]; empty: string }) {
  if (!flags.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {flags.map((flag, index) => (
        <li key={`${flag.rule_code}-${index}`} className="rounded-xl border border-border/75 bg-background/35 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={flag.score_impact >= 12 ? "bad" : flag.score_impact >= 8 ? "warn" : "neutral"}>{flag.category}</Badge>
            <span className="font-mono text-[10px] text-muted-foreground">{flag.rule_code}</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">+{flag.score_impact}</span>
          </div>
          <p className="mt-2 text-sm leading-6">{flag.reason}</p>
        </li>
      ))}
    </ul>
  );
}

export default function SentraTesterPage() {
  const { token } = useAuth();
  const [targets, setTargets] = useState<Targets | null>(null);
  const [scenarioId, setScenarioId] = useState(PRESETS[1].id);
  const preset = PRESETS.find((item) => item.id === scenarioId) || PRESETS[0];

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [reviewSourceMode, setReviewSourceMode] = useState<ReviewSourceMode>("linked");
  const [review, setReview] = useState<ReviewScenario>(preset.review);
  const [seller, setSeller] = useState<SellerScenario>(preset.seller);
  const [product, setProduct] = useState<ProductScenario>(preset.product);
  const [trust, setTrust] = useState<TrustScenario>(preset.trust);
  const [sellerChecksEnabled, setSellerChecksEnabled] = useState(true);
  const [listingChecksEnabled, setListingChecksEnabled] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewAnalysis | null>(null);
  const [sellerResult, setSellerResult] = useState<SellerAnalysis | null>(null);
  const [productResult, setProductResult] = useState<ProductAnalysis | null>(null);
  const [trustResult, setTrustResult] = useState<TrustAnalysis | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api
      .get<Targets>("/admin/sentra/sample-targets", token)
      .then((data) => {
        if (!alive) return;
        setTargets(data);
        setSelectedProductId(data.products[0]?.id || "");
        setSelectedUserId(data.profiles[0]?.id || "");
        setReviewSourceMode("linked");
      })
      .catch((err) => {
        if (!alive) return;
        setError((err as Error).message || "Could not load Sentra targets.");
      })
      .finally(() => {
        if (alive) setBooting(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const selectedProduct = useMemo(() => targets?.products.find((item) => item.id === selectedProductId) || null, [selectedProductId, targets]);
  const selectedUser = useMemo(() => targets?.profiles.find((item) => item.id === selectedUserId) || null, [selectedUserId, targets]);

  const overallStory = useMemo(() => {
    if (!reviewResult || !sellerResult || !productResult || !trustResult) return [];
    const events: string[] = [];
    events.push(reviewResult.status === "quarantined" ? "review is auto-quarantined before it reaches the store" : reviewResult.status === "flagged" ? "review is routed to moderation instead of publishing directly" : "review is allowed to publish");
    events.push(trustResult.trust_label === "High Risk Reviewer" ? "account drops into High Risk Reviewer status" : trustResult.trust_label === "Moderate Risk Reviewer" ? "account remains under moderate risk monitoring" : "account stays trusted");
    if (sellerChecksEnabled && sellerResult.risk_label !== "Strong") events.push(`seller onboarding falls into ${sellerResult.risk_label.toLowerCase()} verification`);
    if (listingChecksEnabled && productResult.risk_label !== "Genuine") events.push(`listing is marked ${productResult.risk_label.toLowerCase()} before catalog approval`);
    return events;
  }, [listingChecksEnabled, productResult, reviewResult, sellerChecksEnabled, sellerResult, trustResult]);

  function loadPreset(nextPreset: ScenarioPack) {
    setScenarioId(nextPreset.id);
    setReview(nextPreset.review);
    setSeller(nextPreset.seller);
    setProduct(nextPreset.product);
    setTrust(nextPreset.trust);
    setReviewResult(null);
    setSellerResult(null);
    setProductResult(null);
    setTrustResult(null);
    setReviewSourceMode("linked");
    setSellerChecksEnabled(true);
    setListingChecksEnabled(true);
  }

  function updateReview<K extends keyof ReviewScenario>(key: K, value: ReviewScenario[K]) {
    setReviewSourceMode("custom");
    setReview((current) => ({ ...current, [key]: value }));
  }

  function updateReviewFlag(key: keyof ReviewScenario, value: boolean) {
    updateReview(key, value as ReviewScenario[keyof ReviewScenario]);
  }

  function syncFromSelectedUser() {
    if (!selectedUser) return;
    const completedFields = [selectedUser.full_name, selectedUser.username, selectedUser.phone, selectedUser.address].filter(Boolean).length;
    setReview((current) => ({
      ...current,
      username: selectedUser.username || current.username,
      hasFullName: Boolean(selectedUser.full_name),
      hasPhone: Boolean(selectedUser.phone),
      hasAddress: Boolean(selectedUser.address),
      accountAgeHours: accountAgeDaysFromIso(selectedUser.created_at) * 24,
    }));
    setTrust((current) => ({
      ...current,
      accountAgeDays: accountAgeDaysFromIso(selectedUser.created_at),
      completedFields,
    }));
    setReviewSourceMode("linked");
  }

  function syncFromSelectedProduct() {
    if (!selectedProduct) return;
    setProduct((current) => ({
      ...current,
      name: selectedProduct.name || current.name,
    }));
  }

  async function runSimulation() {
    if (!token) return;
    setError(null);
    setProcessing(true);
    const startedAt = Date.now();
    try {
      const apiResult = await api.post<{ analysis: ReviewAnalysis }>(
        "/admin/sentra/test-review",
        {
          rating: review.rating,
          title: review.title,
          body: review.body,
          product_id: selectedProductId || undefined,
          user_id: selectedUserId || undefined,
          username: review.username,
          full_name: review.hasFullName ? selectedUser?.full_name || "Linked customer" : "",
          phone: review.hasPhone ? selectedUser?.phone || "0770000000" : "",
          address: review.hasAddress ? selectedUser?.address || "Colombo" : "",
          verified_purchase_override: review.hasVerifiedPurchase,
          account_age_hours_override: review.accountAgeHours,
          trust_score_override: review.priorTrustScore,
          duplicate_text_override: review.duplicateTextFromAnotherUser,
          review_burst_count_override: review.userReviewBurstCount,
          same_text_other_products_override: review.reusedSameTextAcrossProducts,
          product_review_cluster_count_override: review.productReviewClusterCount,
          shared_device_accounts_override: review.sharedDeviceAccounts,
          shared_ip_accounts_override: review.sharedIpAccounts,
          device_review_burst_count_override: review.deviceReviewBurstCount,
          extreme_rating_burst_count_override: review.extremeRatingBurstCount,
          new_account_rating_cluster_count_override: review.newAccountExtremeCount,
        },
        token,
      );

      const localSeller = sellerChecksEnabled ? simulateSeller(seller) : disabledSellerResult();
      const localProduct = listingChecksEnabled ? simulateProduct(product) : disabledProductResult();
      const localTrust = simulateTrust(trust);
      const minDelay = 1200;
      const remaining = Math.max(0, minDelay - (Date.now() - startedAt));
      await new Promise((resolve) => setTimeout(resolve, remaining));

      setReviewResult(apiResult.analysis);
      setSellerResult(localSeller);
      setProductResult(localProduct);
      setTrustResult(localTrust);
    } catch (err) {
      setError((err as Error).message || "Sentra review run failed.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <AppShell>
      <div className="px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 rounded-[1.75rem] border border-border bg-[radial-gradient(circle_at_top_left,rgba(68,131,255,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] p-6 shadow-[var(--shadow-soft)]">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
            <FlaskConical className="size-3.5" />
            Sentra engine lab
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-[-0.04em] md:text-5xl">Run Sentra attack cases against real users and products.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
            Choose the case, bind it to an existing product and user, and let Sentra process the result across review scoring, trust, seller verification, and listing checks.
          </p>
        </header>

        {error ? <div className="mb-6 rounded-xl border border-danger/35 bg-danger/10 p-4 text-sm text-danger">{error}</div> : null}

        <Section title="Attack presets" eyebrow="One-click demos" icon={<Play className="size-3.5" />}>
          <div className="grid gap-3 lg:grid-cols-3">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => loadPreset(item)}
                className={`rounded-[1.25rem] border p-4 text-left transition ${
                  scenarioId === item.id ? "border-primary bg-primary/10" : "border-border bg-background/35 hover:border-primary/30 hover:bg-background/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <Badge tone={item.tone}>{item.tone === "bad" ? "High pressure" : item.tone === "warn" ? "Suspicious" : "Clean"}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </button>
            ))}
          </div>
        </Section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
          <div className="grid gap-5">
            <Section title="Target binding" eyebrow="Real records" icon={<UserRound className="size-3.5" />}>
              {booting ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="h-24 rounded-2xl bg-muted shimmer" />
                  <div className="h-24 rounded-2xl bg-muted shimmer" />
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-border bg-background/35 p-4">
                    <label className="text-xs font-medium text-muted-foreground">Existing product</label>
                    <select
                      value={selectedProductId}
                      onChange={(event) => setSelectedProductId(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm"
                    >
                      {targets?.products.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {selectedProduct ? (
                      <div className="mt-3 text-sm text-muted-foreground">
                        <p className="font-semibold text-foreground">{selectedProduct.name}</p>
                        <p>{selectedProduct.category || "General"} · {selectedProduct.seller_name || "Seller"} · avg {selectedProduct.average_rating.toFixed(1)}★</p>
                      </div>
                    ) : null}
                    <Button variant="secondary" className="mt-3 w-full" onClick={syncFromSelectedProduct}>Use this product</Button>
                  </div>

                  <div className="rounded-[1.25rem] border border-border bg-background/35 p-4">
                    <label className="text-xs font-medium text-muted-foreground">Existing user</label>
                    <select
                      value={selectedUserId}
                      onChange={(event) => setSelectedUserId(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm"
                    >
                      {targets?.profiles.map((item) => (
                        <option key={item.id} value={item.id}>
                          @{item.username}
                        </option>
                      ))}
                    </select>
                    {selectedUser ? (
                      <div className="mt-3 text-sm text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">@{selectedUser.username}</p>
                          <Badge tone="neutral">{selectedUser.role}</Badge>
                          <Badge tone={selectedUser.status === "active" ? "good" : selectedUser.status === "monitored" ? "warn" : "bad"}>{selectedUser.status}</Badge>
                        </div>
                        <p className="mt-1">{selectedUser.full_name || "No full name"} · {accountAgeDaysFromIso(selectedUser.created_at)} days old</p>
                      </div>
                    ) : null}
                    <Button variant="secondary" className="mt-3 w-full" onClick={syncFromSelectedUser}>Use this user</Button>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone={reviewSourceMode === "linked" ? "good" : "warn"}>{reviewSourceMode === "linked" ? "Linked customer" : "Custom customer"}</Badge>
                      <span>{reviewSourceMode === "linked" ? "Review fields currently mirror the selected user." : "Review fields have been edited for a custom case."}</span>
                    </div>
                  </div>
                </div>
              )}
            </Section>

            <Section title="Review engine inputs" eyebrow="Review engine" icon={<Zap className="size-3.5" />}>
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Rating</label>
                    <div className="mt-1.5 flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateReview("rating", value)}
                          className={`grid min-h-11 min-w-11 place-items-center rounded-xl border px-3 text-sm font-semibold ${
                            review.rating >= value ? "border-primary bg-primary/14 text-primary" : "border-border bg-background/35 text-muted-foreground"
                          }`}
                        >
                          {value}★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Reviewer username</label>
                    <input value={review.username} onChange={(event) => updateReview("username", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Review title</label>
                    <input value={review.title} onChange={(event) => updateReview("title", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Account age in hours</label>
                    <input type="number" value={review.accountAgeHours} onChange={(event) => updateReview("accountAgeHours", Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Review body</label>
                  <textarea rows={5} value={review.body} onChange={(event) => updateReview("body", event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background/70 px-3 py-3 text-sm" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Prior trust score</label>
                    <input type="number" value={review.priorTrustScore} onChange={(event) => updateReview("priorTrustScore", Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">User review burst</label>
                    <input type="number" value={review.userReviewBurstCount} onChange={(event) => updateReview("userReviewBurstCount", Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Product review cluster</label>
                    <input type="number" value={review.productReviewClusterCount} onChange={(event) => updateReview("productReviewClusterCount", Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Device review burst</label>
                    <input type="number" value={review.deviceReviewBurstCount} onChange={(event) => updateReview("deviceReviewBurstCount", Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Shared device accounts</label>
                    <input type="number" value={review.sharedDeviceAccounts} onChange={(event) => updateReview("sharedDeviceAccounts", Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Shared IP accounts</label>
                    <input type="number" value={review.sharedIpAccounts} onChange={(event) => updateReview("sharedIpAccounts", Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Extreme rating burst</label>
                    <input type="number" value={review.extremeRatingBurstCount} onChange={(event) => updateReview("extremeRatingBurstCount", Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">New-account extreme count</label>
                    <input type="number" value={review.newAccountExtremeCount} onChange={(event) => updateReview("newAccountExtremeCount", Number(event.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm" />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["Verified purchase", review.hasVerifiedPurchase, "hasVerifiedPurchase"],
                    ["Full name present", review.hasFullName, "hasFullName"],
                    ["Phone present", review.hasPhone, "hasPhone"],
                    ["Address present", review.hasAddress, "hasAddress"],
                    ["Duplicate text from another user", review.duplicateTextFromAnotherUser, "duplicateTextFromAnotherUser"],
                    ["Same text on other products", review.reusedSameTextAcrossProducts, "reusedSameTextAcrossProducts"],
                  ].map(([label, checked, key]) => (
                    <label key={String(key)} className="flex items-center gap-2 rounded-xl border border-border bg-background/35 px-3 py-2 text-sm">
                      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => updateReviewFlag(String(key) as keyof ReviewScenario, event.target.checked)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Seller and listing conditions" eyebrow="Supporting checks" icon={<Store className="size-3.5" />}>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className={`grid gap-3 rounded-[1.25rem] border p-4 ${sellerChecksEnabled ? "border-border bg-background/20" : "border-border/60 bg-background/10 opacity-70"}`}>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/35 px-3 py-3 text-sm">
                    <span className="font-semibold">Enable seller checks</span>
                    <input type="checkbox" checked={sellerChecksEnabled} onChange={(event) => setSellerChecksEnabled(event.target.checked)} />
                  </label>
                  <input disabled={!sellerChecksEnabled} value={seller.storeName} onChange={(event) => setSeller((current) => ({ ...current, storeName: event.target.value }))} className="min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" placeholder="Store name" />
                  {[
                    ["NIC uploaded", seller.hasNic, "hasNic"],
                    ["Utility bill uploaded", seller.hasUtilityBill, "hasUtilityBill"],
                    ["Customer profile complete", seller.profileComplete, "profileComplete"],
                    ["Contact mismatch", seller.contactMismatch, "contactMismatch"],
                    ["Payment reused elsewhere", seller.reusedPayment, "reusedPayment"],
                    ["Repeated seller submissions", seller.repeatedApplications, "repeatedApplications"],
                  ].map(([label, checked, key]) => (
                    <label key={String(key)} className="flex items-center gap-2 rounded-xl border border-border bg-background/35 px-3 py-2 text-sm">
                      <input disabled={!sellerChecksEnabled} type="checkbox" checked={Boolean(checked)} onChange={(event) => setSeller((current) => ({ ...current, [String(key)]: event.target.checked } as SellerScenario))} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <div className={`grid gap-3 rounded-[1.25rem] border p-4 ${listingChecksEnabled ? "border-border bg-background/20" : "border-border/60 bg-background/10 opacity-70"}`}>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/35 px-3 py-3 text-sm">
                    <span className="font-semibold">Enable listing checks</span>
                    <input type="checkbox" checked={listingChecksEnabled} onChange={(event) => setListingChecksEnabled(event.target.checked)} />
                  </label>
                  <input disabled={!listingChecksEnabled} value={product.name} onChange={(event) => setProduct((current) => ({ ...current, name: event.target.value }))} className="min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" placeholder="Product name" />
                  <textarea disabled={!listingChecksEnabled} rows={4} value={product.description} onChange={(event) => setProduct((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-border bg-background/70 px-3 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" placeholder="Product description" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input disabled={!listingChecksEnabled} type="number" value={product.price} onChange={(event) => setProduct((current) => ({ ...current, price: Number(event.target.value) || 0 }))} className="min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" placeholder="Price" />
                    <input disabled={!listingChecksEnabled} type="number" value={product.uploadBurstCount} onChange={(event) => setProduct((current) => ({ ...current, uploadBurstCount: Number(event.target.value) || 0 }))} className="min-h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" placeholder="Recent upload count" />
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-border bg-background/35 px-3 py-2 text-sm">
                    <input disabled={!listingChecksEnabled} type="checkbox" checked={product.duplicateText} onChange={(event) => setProduct((current) => ({ ...current, duplicateText: event.target.checked }))} />
                    <span>Duplicate listing text exists from another seller</span>
                  </label>
                </div>
              </div>
            </Section>
          </div>

          <div className="grid gap-5">
            <Section title="Sentra run" eyebrow="Engine execution" icon={<ShieldAlert className="size-3.5" />}>
              <div className="rounded-[1.35rem] border border-primary/25 bg-[radial-gradient(circle_at_top,rgba(55,214,139,0.13),transparent_45%),rgba(4,18,14,0.75)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Run this case through Sentra</p>
                    <p className="mt-1 text-sm text-muted-foreground">Uses the selected real product and user context for the engine result.</p>
                  </div>
                  <Button onClick={runSimulation} disabled={processing || booting || !token}>
                    <Play className="size-4" />
                    {processing ? "Sentra is processing..." : "Run Sentra engine"}
                  </Button>
                </div>

                {processing ? (
                  <div className="mt-5 grid gap-4 rounded-[1.2rem] border border-primary/20 bg-background/30 p-4 md:grid-cols-[1fr_120px]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Engine activity</p>
                      <div className="mt-3 space-y-3">
                        {["Scanning text patterns", "Cross-checking account trust", "Inspecting shared device and IP signals", "Preparing moderation decision"].map((step, index) => (
                          <div key={step} className="flex items-center gap-3">
                            <span className="size-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${index * 120}ms` }} />
                            <span className="text-sm text-muted-foreground">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid place-items-center">
                      <div className="relative size-20">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary" />
                        <div className="absolute inset-4 rounded-full bg-primary/10 blur-md" />
                      </div>
                    </div>
                  </div>
                ) : null}

                {!processing && reviewResult && sellerResult && productResult && trustResult ? (
                  <div className="mt-5 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1.2rem] border border-border bg-background/35 p-4">
                        <div className="grid items-center gap-4 md:grid-cols-[150px_1fr]">
                          <RiskGauge score={reviewResult.risk_score} label="review risk" />
                          <div>
                            <Badge tone={toneForLabel(reviewResult.risk_label)}>{reviewResult.risk_label}</Badge>
                            <p className="mt-3 text-lg font-semibold">{reviewResult.status === "quarantined" ? "Auto-quarantined" : reviewResult.status === "flagged" ? "Flagged for moderation" : "Published"}</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{reviewResult.flags.length} rules triggered from the review engine.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[1.2rem] border border-border bg-background/35 p-4">
                        <div className="flex items-center gap-2">
                          <UserRound className="size-4 text-primary" />
                          <p className="text-sm font-semibold">Trust result</p>
                        </div>
                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div>
                            <Badge tone={toneForLabel(trustResult.trust_label)}>{trustResult.trust_label}</Badge>
                            <p className="mt-2 text-sm text-muted-foreground">{trustResult.flagged_reviews} flagged · {trustResult.rejected_reviews} rejected · {trustResult.quarantined_reviews} quarantined</p>
                          </div>
                          <p className="font-mono text-4xl font-semibold" style={{ color: scoreColor(100 - trustResult.trust_score) }}>{trustResult.trust_score}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.2rem] border border-primary/20 bg-primary/8 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Engine response</p>
                      <ul className="mt-3 space-y-2">
                        {overallStory.map((line) => (
                          <li key={line} className="flex items-start gap-2 text-sm">
                            <span className="mt-1 size-2 rounded-full bg-primary" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>

            <Section title="Triggered review rules" eyebrow="Review evidence" icon={<Fingerprint className="size-3.5" />}>
              <FlagList flags={reviewResult?.flags || []} empty="Run the engine to see which review rules fire." />
            </Section>

            <Section title="Seller verification outcome" eyebrow="Seller response" icon={<Store className="size-3.5" />}>
              {sellerResult ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-[1.2rem] border border-border bg-background/35 p-4">
                  <div>
                    <Badge tone={toneForLabel(sellerResult.risk_label)}>{sellerResult.risk_label}</Badge>
                    <p className="mt-2 text-sm text-muted-foreground">Seller onboarding result for the current case.</p>
                  </div>
                  <p className="font-mono text-4xl font-semibold">{sellerResult.risk_score}</p>
                </div>
              ) : null}
              <FlagList flags={sellerResult?.reasons || []} empty={sellerChecksEnabled ? "Run the engine to see seller verification deductions." : "Seller checks are currently disabled for this run."} />
            </Section>

            <Section title="Listing screening outcome" eyebrow="Catalog response" icon={<ShieldCheck className="size-3.5" />}>
              {productResult ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-[1.2rem] border border-border bg-background/35 p-4">
                  <div>
                    <Badge tone={toneForLabel(productResult.risk_label)}>{productResult.risk_label}</Badge>
                    <p className="mt-2 text-sm text-muted-foreground">Listing screening result for the current case.</p>
                  </div>
                  <p className="font-mono text-4xl font-semibold">{productResult.risk_score}</p>
                </div>
              ) : null}
              <FlagList flags={productResult?.reasons || []} empty={listingChecksEnabled ? "Run the engine to see listing screening deductions." : "Listing checks are currently disabled for this run."} />
            </Section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
