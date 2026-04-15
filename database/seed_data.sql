insert into products (id, name, slug, description, price, stock, category, seller_name, image_url, average_rating)
values
  ('11111111-1111-4111-8111-111111111111', 'Aster Carry Pack', 'aster-carry-pack', 'A compact everyday backpack with structured pockets and weather-resistant fabric.', 64.90, 42, 'Bags', 'Orion Goods', 'https://picsum.photos/seed/aster-pack/900/700', 4.6),
  ('22222222-2222-4222-8222-222222222222', 'LumaDesk Lamp', 'lumadesk-lamp', 'A dimmable desk lamp with warm focus modes for study and remote work.', 39.50, 28, 'Home Office', 'Kairo Studio', 'https://picsum.photos/seed/lumadesk/900/700', 4.4),
  ('33333333-3333-4333-8333-333333333333', 'Mira Ceramic Mug', 'mira-ceramic-mug', 'Hand-finished ceramic mug with a balanced handle and matte glaze.', 18.75, 80, 'Kitchen', 'Clayline Co.', 'https://picsum.photos/seed/mira-mug/900/700', 4.8),
  ('44444444-4444-4444-8444-444444444444', 'VoltEdge Earbuds', 'voltedge-earbuds', 'Wireless earbuds with clear call pickup and long commute battery life.', 72.00, 35, 'Electronics', 'Northline Audio', 'https://picsum.photos/seed/voltedge/900/700', 4.1),
  ('55555555-5555-4555-8555-555555555555', 'Forma Training Bottle', 'forma-training-bottle', 'A leak-resistant steel bottle designed for gym bags and day trips.', 24.30, 63, 'Fitness', 'Forma Works', 'https://picsum.photos/seed/forma-bottle/900/700', 4.5)
on conflict (id) do nothing;

-- Replace these auth_user_id values after creating users in Supabase Auth.
insert into profiles (id, auth_user_id, full_name, username, role, phone, address, status, created_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-4000-8000-000000000001', 'Maleesha Perera', 'maleesha_p', 'admin', '+94 77 412 9081', 'Colombo 05', 'active', now() - interval '120 days'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-4000-8000-000000000002', 'Naveen Rathnayake', 'naveen_r', 'customer', '+94 71 846 2042', 'Kandy', 'active', now() - interval '90 days'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-4000-8000-000000000003', 'Imasha Fernando', 'imasha_f', 'customer', '+94 76 304 7721', 'Galle', 'active', now() - interval '65 days'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '00000000-0000-4000-8000-000000000004', '', 'user84729', 'customer', '', '', 'monitored', now() - interval '1 day'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '00000000-0000-4000-8000-000000000005', '', 'user91384', 'customer', '', '', 'monitored', now() - interval '1 day')
on conflict (id) do nothing;

insert into orders (id, user_id, total_amount, status, created_at)
values
  ('90000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 83.65, 'paid', now() - interval '12 days'),
  ('90000000-0000-4000-8000-000000000002', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 72.00, 'paid', now() - interval '8 days')
on conflict (id) do nothing;

insert into order_items (order_id, product_id, quantity, unit_price)
values
  ('90000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 64.90),
  ('90000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 1, 18.75),
  ('90000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 1, 72.00);

insert into reviews (id, product_id, user_id, rating, title, body, status, risk_score, risk_label, is_verified_purchase, created_at)
values
  ('70000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 5, 'Useful for campus days', 'The compartments are actually practical. My laptop sleeve stays firm and the front pocket fits chargers without bulging.', 'published', 12, 'Genuine', true, now() - interval '10 days'),
  ('70000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 4, 'Clear calls', 'Call quality is cleaner than my old pair. The case feels a little light, but battery life has been solid.', 'published', 18, 'Genuine', true, now() - interval '6 days'),
  ('70000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 5, 'Best product', 'good product', 'flagged', 48, 'Suspicious', false, now() - interval '45 minutes'),
  ('70000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 5, 'Amazing', 'Amazing amazing amazing must buy best ever guaranteed perfect item!!!', 'quarantined', 72, 'High Risk', false, now() - interval '35 minutes')
on conflict (id) do nothing;

insert into review_flags (review_id, category, rule_code, reason, score_impact)
values
  ('70000000-0000-4000-8000-000000000003', 'Text Risk', 'GENERIC_REVIEW', 'Review uses generic wording.', 9),
  ('70000000-0000-4000-8000-000000000003', 'Profile Risk', 'NO_VERIFIED_PURCHASE', 'User has no purchase history for this product.', 8),
  ('70000000-0000-4000-8000-000000000004', 'Text Risk', 'REPEATED_WORDS', 'Review repeats words unnaturally.', 8),
  ('70000000-0000-4000-8000-000000000004', 'Text Risk', 'MARKETING_LANGUAGE', 'Review uses promotional language.', 8),
  ('70000000-0000-4000-8000-000000000004', 'Profile Risk', 'NEW_ACCOUNT', 'User account is newly created.', 8);

insert into user_trust_scores (user_id, trust_score, trust_label, approved_reviews, flagged_reviews, rejected_reviews)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 88, 'Trusted Reviewer', 1, 0, 0),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 82, 'Trusted Reviewer', 1, 0, 0),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 38, 'Moderate Risk Reviewer', 0, 1, 0),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 18, 'High Risk Reviewer', 0, 0, 0)
on conflict (user_id) do update set trust_score = excluded.trust_score, trust_label = excluded.trust_label;

insert into rating_anomaly_alerts (product_id, alert_type, severity, description, status)
values
  ('22222222-2222-4222-8222-222222222222', 'five_star_burst', 'high', 'Several new accounts posted 5-star reviews for LumaDesk Lamp within two hours.', 'open')
on conflict do nothing;

-- ============================================================
-- SELLER DEMO DATA
-- Demonstrates the full seller onboarding + Sentra risk flow.
-- Run this block as a single transaction on a fresh database.
-- IDs are generated by the database (gen_random_uuid()).
-- The genuine seller section uses a CTE so products, orders,
-- and reviews all reference the same generated seller ID.
-- ============================================================

-- Two pending applicant profiles (no auth users required for demo).
-- The suspicious applicant and incomplete applicant reference
-- these profiles in seller_applications below.
do $$
declare
  v_suspicious_profile_id uuid;
  v_incomplete_profile_id uuid;
  v_seller_profile_id     uuid;
  v_seller_id             uuid;
  v_app_approved_id       uuid;
  v_prod_soap_id          uuid;
  v_prod_tea_id           uuid;
  v_prod_candle_id        uuid;
  v_prod_cream_id         uuid;
  v_prod_tablets_id       uuid;
  v_order1 uuid; v_order2 uuid; v_order3 uuid; v_order4 uuid; v_order5 uuid;
  v_rev_soap_genuine      uuid;
  v_rev_tea_genuine       uuid;
  v_rev_soap_flagged      uuid;
  v_rev_tea_quarantined   uuid;
begin
  -- Genuine seller profile (role = seller)
  insert into profiles (auth_user_id, full_name, username, role, phone, address, status, created_at)
  values (gen_random_uuid(), 'Priya Wickramasinghe', 'priya_w', 'seller', '+94 77 501 3822', 'Nugegoda, Colombo', 'active', now() - interval '45 days')
  on conflict (username) do nothing
  returning id into v_seller_profile_id;

  if v_seller_profile_id is null then
    select id into v_seller_profile_id from profiles where username = 'priya_w';
  end if;

  -- Suspicious applicant profile
  insert into profiles (auth_user_id, full_name, username, role, phone, address, status, created_at)
  values (gen_random_uuid(), '', 'user_store99', 'customer', '', '', 'active', now() - interval '3 days')
  on conflict (username) do nothing
  returning id into v_suspicious_profile_id;

  if v_suspicious_profile_id is null then
    select id into v_suspicious_profile_id from profiles where username = 'user_store99';
  end if;

  -- Incomplete applicant profile
  insert into profiles (auth_user_id, full_name, username, role, phone, address, status, created_at)
  values (gen_random_uuid(), 'Lasith Mendis', 'lasith_m', 'customer', '+94 71 200 4400', 'Kandy', 'active', now() - interval '20 days')
  on conflict (username) do nothing
  returning id into v_incomplete_profile_id;

  if v_incomplete_profile_id is null then
    select id into v_incomplete_profile_id from profiles where username = 'lasith_m';
  end if;

  -- Approved seller record for Priya
  insert into sellers (profile_id, store_name, slug, business_or_personal_name, email, phone, address, bank_name, account_holder, account_number, account_number_last4, status, trust_score, created_at)
  values (v_seller_profile_id, 'GreenLeaf Home Store', 'greenleaf-home-store', 'Priya Wickramasinghe', 'priya.w@greenleaf.lk', '+94 77 501 3822', 'Nugegoda, Colombo', 'People''s Bank', 'Priya Wickramasinghe', '2049984471', '4471', 'active', 88, now() - interval '40 days')
  on conflict (profile_id) do nothing
  returning id into v_seller_id;

  if v_seller_id is null then
    select id into v_seller_id from sellers where profile_id = v_seller_profile_id;
  end if;

  -- Approved application for Priya
  insert into seller_applications (profile_id, application_type, business_or_personal_name, email, phone, store_name, address, bank_name, account_holder, account_number, account_number_last4, status, risk_score, risk_label, risk_reasons, submitted_at, reviewed_at)
  values (v_seller_profile_id, 'personal', 'Priya Wickramasinghe', 'priya.w@greenleaf.lk', '+94 77 501 3822', 'GreenLeaf Home Store', 'Nugegoda, Colombo', 'People''s Bank', 'Priya Wickramasinghe', '2049984471', '4471', 'approved', 100, 'Strong', '[{"rule_code": "PROFILE_COMPLETE", "category": "Profile", "reason": "Complete profile with contact information provided.", "score_impact": 0}]', now() - interval '44 days', now() - interval '40 days')
  returning id into v_app_approved_id;

  -- At-risk pending application (BestBest99Store, seller score 25)
  insert into seller_applications (profile_id, application_type, business_or_personal_name, email, phone, store_name, address, status, risk_score, risk_label, risk_reasons, submitted_at)
  values (v_suspicious_profile_id, 'personal', 'Best Products Store', 'beststore99@gmail.com', '', 'BestBest99Store', '', 'pending', 25, 'At Risk', '[{"rule_code": "SUSPICIOUS_STORE_NAME", "category": "Identity Risk", "reason": "Store name contains repeated words or keyword patterns.", "score_impact": 18}, {"rule_code": "MISSING_DOCUMENTS", "category": "Document Risk", "reason": "No identity documents have been uploaded.", "score_impact": 20}, {"rule_code": "MISSING_CONTACT", "category": "Profile Risk", "reason": "Phone number and address are missing.", "score_impact": 15}, {"rule_code": "NEW_ACCOUNT", "category": "Profile Risk", "reason": "Account was created very recently.", "score_impact": 12}, {"rule_code": "INCOMPLETE_PROFILE", "category": "Profile Risk", "reason": "Profile is missing display name.", "score_impact": 10}]', now() - interval '2 days');

  -- Incomplete pending application (Lasith Handcraft, seller score 65)
  insert into seller_applications (profile_id, application_type, business_or_personal_name, email, phone, store_name, address, status, risk_score, risk_label, risk_reasons, submitted_at)
  values (v_incomplete_profile_id, 'personal', 'Lasith Mendis', 'lasith.m@gmail.com', '+94 71 200 4400', 'Lasith Handcraft', 'Kandy', 'pending', 65, 'Needs Review', '[{"rule_code": "MISSING_DOCUMENTS", "category": "Document Risk", "reason": "No identity documents have been uploaded.", "score_impact": 20}, {"rule_code": "MISSING_BANK_DETAILS", "category": "Payment Risk", "reason": "Bank account information has not been provided.", "score_impact": 15}]', now() - interval '5 days');

  -- Seller products: 2 approved, 1 pending clean, 1 pending high-risk, 1 rejected
  insert into products (name, slug, description, price, stock, category, seller_name, seller_id, image_url, average_rating, approval_status, product_risk_score, product_risk_label, product_risk_reasons, submitted_at, approved_at)
  values ('Aloe Vera Handmade Soap', 'greenleaf-aloe-vera-soap', 'Handcrafted cold-process soap with pure aloe vera gel and shea butter. Suitable for sensitive skin. Each bar is individually wrapped and weighs approximately 100g.', 850.00, 48, 'Beauty', 'GreenLeaf Home Store', v_seller_id, 'https://picsum.photos/seed/aloe-soap/900/700', 4.7, 'approved', 12, 'Low Risk', '[{"rule_code": "CLEAR_DESCRIPTION", "category": "Listing Quality", "reason": "Product description is detailed and informative.", "score_impact": 0}]', now() - interval '38 days', now() - interval '36 days')
  returning id into v_prod_soap_id;

  insert into products (name, slug, description, price, stock, category, seller_name, seller_id, image_url, average_rating, approval_status, product_risk_score, product_risk_label, product_risk_reasons, submitted_at, approved_at)
  values ('Ceylon Loose Leaf Tea Blend', 'greenleaf-ceylon-tea-blend', 'A premium single-origin loose leaf tea from the Nuwara Eliya highlands. Brisk floral aroma with a clean bright liquor. 100g resealable pouch.', 1250.00, 30, 'Food & Drink', 'GreenLeaf Home Store', v_seller_id, 'https://picsum.photos/seed/ceylon-tea/900/700', 4.5, 'approved', 8, 'Low Risk', '[{"rule_code": "CLEAR_DESCRIPTION", "category": "Listing Quality", "reason": "Product description is detailed and informative.", "score_impact": 0}]', now() - interval '35 days', now() - interval '33 days')
  returning id into v_prod_tea_id;

  insert into products (name, slug, description, price, stock, category, seller_name, seller_id, image_url, average_rating, approval_status, product_risk_score, product_risk_label, product_risk_reasons, submitted_at)
  values ('Soy Wax Candle Set', 'greenleaf-soy-wax-candle-set', 'Set of three handpoured soy wax candles with natural cotton wicks. Scents include jasmine, cinnamon, and sandalwood. Burn time approximately 35 hours each.', 1900.00, 15, 'Home', 'GreenLeaf Home Store', v_seller_id, 'https://picsum.photos/seed/soy-candle/900/700', 0, 'pending_review', 18, 'Low Risk', '[{"rule_code": "GOOD_LISTING", "category": "Listing Quality", "reason": "Listing meets quality standards.", "score_impact": 0}]', now() - interval '1 day')
  returning id into v_prod_candle_id;

  insert into products (name, slug, description, price, stock, category, seller_name, seller_id, image_url, average_rating, approval_status, product_risk_score, product_risk_label, product_risk_reasons, submitted_at)
  values ('AMAZING Miracle Skin Cream BEST RESULTS GUARANTEED', 'greenleaf-miracle-skin-cream', 'This is the BEST cream on the market! Amazing results guaranteed! Best best best product! Buy now and get perfect skin forever! Miracle formula that works 100% of the time. Best price best quality best everything! Limited time offer amazing deal!', 14999.00, 200, 'Beauty', 'GreenLeaf Home Store', v_seller_id, 'https://picsum.photos/seed/skin-cream/900/700', 0, 'pending_review', 74, 'High Risk', '[{"rule_code": "MARKETING_LANGUAGE", "category": "Listing Quality", "reason": "Description uses excessive promotional language.", "score_impact": 20}, {"rule_code": "REPEATED_WORDS", "category": "Listing Quality", "reason": "Product title and description repeat words unnaturally.", "score_impact": 15}, {"rule_code": "UNUSUAL_PRICING", "category": "Pricing Risk", "reason": "Product price is significantly above category average.", "score_impact": 18}, {"rule_code": "VAGUE_CLAIMS", "category": "Listing Quality", "reason": "Description makes unverifiable health or performance claims.", "score_impact": 12}]', now() - interval '6 hours')
  returning id into v_prod_cream_id;

  insert into products (name, slug, description, price, stock, category, seller_name, seller_id, image_url, average_rating, approval_status, product_risk_score, product_risk_label, product_risk_reasons, submitted_at)
  values ('Generic Wellness Tablets', 'greenleaf-generic-wellness-tablets', 'Good tablets for health. Very good. Best product.', 4500.00, 0, 'Health', 'GreenLeaf Home Store', v_seller_id, 'https://picsum.photos/seed/wellness-tabs/900/700', 0, 'rejected', 68, 'High Risk', '[{"rule_code": "SHORT_DESCRIPTION", "category": "Listing Quality", "reason": "Product description is too short and uninformative.", "score_impact": 20}, {"rule_code": "MARKETING_LANGUAGE", "category": "Listing Quality", "reason": "Description uses generic promotional wording.", "score_impact": 15}, {"rule_code": "NO_STOCK", "category": "Inventory Risk", "reason": "Product has zero stock at submission.", "score_impact": 10}]', now() - interval '10 days')
  returning id into v_prod_tablets_id;

  -- Seller product review queue entries
  insert into seller_product_reviews (product_id, seller_id, status, risk_score, risk_label, reasons_json, reviewed_at) values
    (v_prod_soap_id,    v_seller_id, 'approved',      12, 'Low Risk',  '[{"reason": "Listing meets quality standards.", "score_impact": 0}]', now() - interval '36 days'),
    (v_prod_tea_id,     v_seller_id, 'approved',       8, 'Low Risk',  '[{"reason": "Listing meets quality standards.", "score_impact": 0}]', now() - interval '33 days'),
    (v_prod_candle_id,  v_seller_id, 'pending_review', 18, 'Low Risk',  '[]', null),
    (v_prod_cream_id,   v_seller_id, 'pending_review', 74, 'High Risk', '[{"reason": "Description uses excessive promotional language.", "score_impact": 20}]', null),
    (v_prod_tablets_id, v_seller_id, 'rejected',       68, 'High Risk', '[{"reason": "Product description is too short and uninformative.", "score_impact": 20}]', now() - interval '8 days');

  -- Orders for approved products (last 7 days for revenue chart)
  insert into orders (user_id, total_amount, status, created_at) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 850.00,  'paid', now() - interval '6 days') returning id into v_order1;
  insert into orders (user_id, total_amount, status, created_at) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 2100.00, 'paid', now() - interval '5 days') returning id into v_order2;
  insert into orders (user_id, total_amount, status, created_at) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1250.00, 'paid', now() - interval '4 days') returning id into v_order3;
  insert into orders (user_id, total_amount, status, created_at) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 3100.00, 'paid', now() - interval '2 days') returning id into v_order4;
  insert into orders (user_id, total_amount, status, created_at) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1700.00, 'paid', now() - interval '1 day')  returning id into v_order5;

  insert into order_items (order_id, product_id, quantity, unit_price) values
    (v_order1, v_prod_soap_id, 1, 850.00),
    (v_order2, v_prod_soap_id, 1, 850.00),
    (v_order2, v_prod_tea_id,  1, 1250.00),
    (v_order3, v_prod_tea_id,  1, 1250.00),
    (v_order4, v_prod_tea_id,  1, 1250.00),
    (v_order4, v_prod_soap_id, 2, 850.00),
    (v_order5, v_prod_soap_id, 2, 850.00);

  -- Customer reviews: 2 genuine, 1 flagged, 1 quarantined
  insert into reviews (product_id, user_id, rating, title, body, status, risk_score, risk_label, is_verified_purchase, created_at) values
    (v_prod_soap_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 5, 'Lovely soap', 'Very gentle on skin. The aloe scent is subtle and the bar lathers well. Will buy again for sure.', 'published', 10, 'Genuine', true, now() - interval '5 days')
  returning id into v_rev_soap_genuine;

  insert into reviews (product_id, user_id, rating, title, body, status, risk_score, risk_label, is_verified_purchase, created_at) values
    (v_prod_tea_id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 4, 'Good tea', 'Nice clean taste. I had it without milk and it was very pleasant. Packaging is a bit plain but the quality is there.', 'published', 14, 'Genuine', true, now() - interval '3 days')
  returning id into v_rev_tea_genuine;

  insert into reviews (product_id, user_id, rating, title, body, status, risk_score, risk_label, is_verified_purchase, created_at) values
    (v_prod_soap_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 5, 'Best soap ever', 'good soap', 'flagged', 52, 'Suspicious', false, now() - interval '2 hours')
  returning id into v_rev_soap_flagged;

  insert into reviews (product_id, user_id, rating, title, body, status, risk_score, risk_label, is_verified_purchase, created_at) values
    (v_prod_tea_id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 5, 'Amazing amazing amazing', 'Amazing amazing amazing amazing best tea best best best best perfect must buy!', 'quarantined', 76, 'High Risk', false, now() - interval '1 hour')
  returning id into v_rev_tea_quarantined;

  insert into review_flags (review_id, category, rule_code, reason, score_impact) values
    (v_rev_soap_flagged,    'Text Risk',    'GENERIC_REVIEW',       'Review text is too short and generic.',           10),
    (v_rev_soap_flagged,    'Profile Risk', 'NO_VERIFIED_PURCHASE', 'User has no purchase history for this product.',   8),
    (v_rev_tea_quarantined, 'Text Risk',    'REPEATED_WORDS',       'Review repeats words unnaturally.',                8),
    (v_rev_tea_quarantined, 'Text Risk',    'MARKETING_LANGUAGE',   'Review uses promotional language.',                8),
    (v_rev_tea_quarantined, 'Profile Risk', 'NEW_ACCOUNT',          'Account was created very recently.',               8),
    (v_rev_tea_quarantined, 'Profile Risk', 'NO_VERIFIED_PURCHASE', 'User has no purchase history for this product.',   8);
end $$;
