create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  full_name text not null default '',
  username text unique not null,
  role text not null default 'customer' check (role in ('customer', 'seller', 'admin')),
  phone text default '',
  address text default '',
  avatar_url text default '',
  status text not null default 'active' check (status in ('active', 'monitored', 'restricted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references profiles(id) on delete cascade,
  store_name text not null,
  slug text unique not null,
  business_or_personal_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  bank_name text default '',
  account_holder text default '',
  account_number text default '',
  account_number_last4 text default '',
  payment_notes text default '',
  status text not null default 'active' check (status in ('active', 'suspended', 'restricted')),
  trust_score integer not null default 75 check (trust_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seller_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  application_type text not null default 'personal' check (application_type in ('personal', 'business')),
  business_or_personal_name text not null,
  email text not null,
  phone text not null,
  store_name text not null,
  address text not null,
  bank_name text default '',
  account_holder text default '',
  account_number text default '',
  account_number_last4 text default '',
  payment_notes text default '',
  status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'rejected', 'changes_requested')),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  risk_label text not null default 'Pending',
  risk_reasons jsonb not null default '[]',
  admin_notes text default '',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Migration (run once if table already exists):
-- alter table sellers add column if not exists account_number text default '';
-- alter table seller_applications add column if not exists account_number text default '';

create table if not exists seller_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references seller_applications(id) on delete cascade,
  document_type text not null check (document_type in ('nic', 'utility_bill', 'business_registration')),
  file_path text not null,
  original_name text not null,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  uploaded_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text not null,
  price numeric(10,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  category text not null,
  seller_name text not null,
  seller_id uuid references sellers(id) on delete set null,
  image_url text not null,
  product_images jsonb not null default '[]',
  average_rating numeric(3,2) not null default 0,
  approval_status text not null default 'approved' check (approval_status in ('pending_review', 'approved', 'rejected', 'changes_requested', 'archived')),
  submitted_at timestamptz,
  approved_at timestamptz,
  rejection_reason text default '',
  product_risk_score integer not null default 0 check (product_risk_score between 0 and 100),
  product_risk_label text not null default 'Genuine',
  product_risk_reasons jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists seller_product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'changes_requested')),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  risk_label text not null default 'Pending',
  reasons_json jsonb not null default '[]',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  status text not null default 'paid' check (status in ('pending', 'paid', 'cancelled')),
  fulfilment_status text check (fulfilment_status in ('packed', 'shipped', 'delivered')),
  created_at timestamptz not null default now()
);
-- Migration (run once if table already exists):
-- alter table orders add column if not exists fulfilment_status text check (fulfilment_status in ('packed', 'shipped', 'delivered'));

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text default '',
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'flagged', 'quarantined', 'approved', 'rejected')),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  risk_label text not null default 'Pending',
  is_verified_purchase boolean not null default false,
  ip_hash text not null default '',
  user_agent text not null default '',
  device_fingerprint text not null default '',
  created_at timestamptz not null default now()
);

-- Migration (run once if reviews already exists):
-- alter table reviews add column if not exists ip_hash text not null default '';
-- alter table reviews add column if not exists user_agent text not null default '';
-- alter table reviews add column if not exists device_fingerprint text not null default '';
-- create index if not exists idx_reviews_device_fingerprint on reviews(device_fingerprint);
-- create index if not exists idx_reviews_ip_hash on reviews(ip_hash);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  status text not null default 'published' check (status in ('published', 'flagged', 'rejected')),
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists review_flags (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  category text not null,
  rule_code text not null,
  reason text not null,
  score_impact integer not null,
  created_at timestamptz not null default now()
);

create table if not exists user_trust_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references profiles(id) on delete cascade,
  trust_score integer not null check (trust_score between 0 and 100),
  trust_label text not null,
  approved_reviews integer not null default 0,
  flagged_reviews integer not null default 0,
  rejected_reviews integer not null default 0,
  quarantined_reviews integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Migration (run once if user_trust_scores already exists):
-- alter table user_trust_scores add column if not exists quarantined_reviews integer not null default 0;

create table if not exists moderation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  action text not null,
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  action_type text not null,
  entity_type text,
  entity_id uuid,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists rating_anomaly_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  alert_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Migration (run once if rating_anomaly_alerts already exists):
-- alter table rating_anomaly_alerts add column if not exists metadata jsonb not null default '{}';

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in ('admin', 'seller', 'customer')),
  type text not null,
  title text not null,
  message text not null,
  href text default '',
  metadata_json jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_auth_user_id on profiles(auth_user_id);
create index if not exists idx_sellers_profile_id on sellers(profile_id);
create index if not exists idx_seller_applications_profile_id on seller_applications(profile_id);
create index if not exists idx_seller_applications_status on seller_applications(status);
create index if not exists idx_seller_documents_application_id on seller_documents(application_id);
create index if not exists idx_seller_product_reviews_product_id on seller_product_reviews(product_id);
create index if not exists idx_products_seller_id on products(seller_id);
create index if not exists idx_products_approval_status on products(approval_status);
create index if not exists idx_reviews_product_id on reviews(product_id);
create index if not exists idx_reviews_user_id on reviews(user_id);
create index if not exists idx_reviews_status on reviews(status);
create index if not exists idx_review_flags_review_id on review_flags(review_id);
create index if not exists idx_activity_logs_user_id on activity_logs(user_id);
create index if not exists idx_cart_items_user_id on cart_items(user_id);
create index if not exists idx_cart_items_product_id on cart_items(product_id);
create index if not exists idx_comments_product_id on comments(product_id);
create index if not exists idx_comments_review_id on comments(review_id);
create index if not exists idx_comments_user_id on comments(user_id);
create index if not exists idx_moderation_logs_admin_id on moderation_logs(admin_id);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_order_items_product_id on order_items(product_id);
create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_rating_anomaly_alerts_product_id on rating_anomaly_alerts(product_id);
create index if not exists idx_user_trust_scores_user_id on user_trust_scores(user_id);
create index if not exists idx_notifications_profile_id_created_at on notifications(profile_id, created_at desc);
create index if not exists idx_notifications_profile_id_read on notifications(profile_id, read);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-documents',
  'seller-documents',
  false,
  8388608,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table profiles enable row level security;
alter table sellers enable row level security;
alter table seller_applications enable row level security;
alter table seller_documents enable row level security;
alter table seller_product_reviews enable row level security;
alter table products enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;
alter table comments enable row level security;
alter table review_flags enable row level security;
alter table user_trust_scores enable row level security;
alter table moderation_logs enable row level security;
alter table activity_logs enable row level security;
alter table rating_anomaly_alerts enable row level security;
alter table notifications enable row level security;

drop policy if exists "public products are readable" on products;
drop policy if exists "public approved products are readable" on products;
create policy "public approved products are readable" on products for select using (approval_status = 'approved');

drop policy if exists "sellers can read own seller row" on sellers;
create policy "sellers can read own seller row" on sellers
  for select using (profile_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1));

drop policy if exists "users can read own seller applications" on seller_applications;
create policy "users can read own seller applications" on seller_applications
  for select using (profile_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1));

drop policy if exists "users can read own seller documents" on seller_documents;
create policy "users can read own seller documents" on seller_documents
  for select using (exists (
    select 1 from seller_applications
    where seller_applications.id = seller_documents.application_id
      and seller_applications.profile_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1)
  ));

drop policy if exists "profiles can read own row" on profiles;
create policy "profiles can read own row" on profiles
  for select using ((select auth.uid()) = auth_user_id);

drop policy if exists "profiles can update own row" on profiles;
create policy "profiles can update own row" on profiles
  for update using ((select auth.uid()) = auth_user_id);

drop policy if exists "cart items are owned by user" on cart_items;
create policy "cart items are owned by user" on cart_items
  for all using (user_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1))
  with check (user_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1));

drop policy if exists "orders are owned by user" on orders;
create policy "orders are owned by user" on orders
  for select using (user_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1));

drop policy if exists "order items are visible to order owner" on order_items;
create policy "order items are visible to order owner" on order_items
  for select using (exists (
    select 1 from orders
    where orders.id = order_items.order_id
      and orders.user_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1)
  ));

drop policy if exists "reviews readable when public or owned" on reviews;
create policy "reviews readable when public or owned" on reviews
  for select using (
    status in ('published', 'approved')
    or user_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1)
  );

drop policy if exists "comments readable when public or owned" on comments;
create policy "comments readable when public or owned" on comments
  for select using (
    status = 'published'
    or user_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1)
  );

drop policy if exists "review flags visible for public reviews" on review_flags;
create policy "review flags visible for public reviews" on review_flags
  for select using (exists (select 1 from reviews where reviews.id = review_flags.review_id and reviews.status in ('published', 'approved')));

drop policy if exists "users can read own trust score" on user_trust_scores;
create policy "users can read own trust score" on user_trust_scores
  for select using (user_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1));

drop policy if exists "admins can read own moderation logs" on moderation_logs;
create policy "admins can read own moderation logs" on moderation_logs
  for select using (admin_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1));

drop policy if exists "users can read own activity logs" on activity_logs;
create policy "users can read own activity logs" on activity_logs
  for select using (user_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1));

drop policy if exists "rating anomaly alerts are readable" on rating_anomaly_alerts;
create policy "rating anomaly alerts are readable" on rating_anomaly_alerts
  for select using (true);

drop policy if exists "users can read own notifications" on notifications;
create policy "users can read own notifications" on notifications
  for select using (profile_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1));

drop policy if exists "users can update own notification read state" on notifications;
create policy "users can update own notification read state" on notifications
  for update using (profile_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1))
  with check (profile_id = (select id from profiles where auth_user_id = (select auth.uid()) limit 1));

revoke update on notifications from anon, authenticated;
grant select on notifications to authenticated;
grant update(read, read_at) on notifications to authenticated;

-- The Flask backend uses the Supabase service role key and bypasses RLS for trusted server-side operations.
