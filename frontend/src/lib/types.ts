export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  seller_name: string;
  seller_id?: string;
  image_url: string;
  product_images?: string[];
  average_rating: number;
  approval_status?: "approved" | "pending_review" | "rejected" | "changes_requested" | "archived";
  product_risk_score?: number;
  product_risk_label?: string;
  product_risk_reasons?: RiskReason[];
  rejection_reason?: string;
  submitted_at?: string;
  approved_at?: string;
};

export type Profile = {
  id: string;
  auth_user_id: string;
  full_name: string;
  username: string;
  email?: string;
  role: "customer" | "seller" | "admin";
  phone?: string;
  address?: string;
  status?: string;
};

export type RiskReason = {
  rule_code?: string;
  category?: string;
  reason: string;
  score_impact?: number;
};

export type SellerDocument = {
  id: string;
  application_id: string;
  document_type: "nic" | "utility_bill" | "business_registration";
  file_path: string;
  original_name: string;
  verification_status: "pending" | "verified" | "rejected";
  uploaded_at: string;
};

export type SellerApplication = {
  id: string;
  profile_id: string;
  application_type: "personal" | "business";
  business_or_personal_name: string;
  email: string;
  phone: string;
  store_name: string;
  address: string;
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  account_number_last4?: string;
  payment_notes?: string;
  status: "draft" | "pending" | "approved" | "rejected" | "changes_requested";
  risk_score: number;
  risk_label: string;
  risk_reasons?: RiskReason[];
  admin_notes?: string;
  submitted_at?: string;
  reviewed_at?: string;
  updated_at?: string;
  seller_documents?: SellerDocument[];
  profiles?: Profile;
};

export type Seller = {
  id: string;
  profile_id: string;
  store_name: string;
  slug: string;
  business_or_personal_name: string;
  email: string;
  phone: string;
  address: string;
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  account_number_last4?: string;
  payment_notes?: string;
  status: "active" | "suspended" | "pending";
  trust_score: number;
  created_at?: string;
};

export type ReviewFlag = {
  id?: string;
  category: string;
  rule_code: string;
  reason: string;
  score_impact: number;
};

export type ReviewSignals = {
  account_age_days: number | null;
  verified_purchase: boolean;
  device_cluster_size: number;
  ip_cluster_size: number;
  device_fingerprint_short: string;
  ip_hash_short: string;
};

export type Review = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  risk_score: number;
  risk_label: string;
  is_verified_purchase: boolean;
  ip_hash?: string;
  user_agent?: string;
  device_fingerprint?: string;
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "username"> & { created_at?: string };
  products?: Pick<Product, "name">;
  review_flags?: ReviewFlag[];
  signals?: ReviewSignals;
};
