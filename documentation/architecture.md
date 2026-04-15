# Sentra Architecture

Sentra is split into three demonstration layers:

1. **NovaMart Frontend**: Next.js App Router customer storefront and admin dashboard.
2. **Flask REST API**: Business logic, role checks, checkout, review submission, moderation, and Sentra Engine scoring.
3. **Supabase**: PostgreSQL database, Supabase Auth, table browser, SQL editor, and demo visibility.

## Runtime Flow

1. A user signs up or logs in with Supabase Auth.
2. The frontend sends the Supabase access token to Flask as a Bearer token.
3. Flask asks Supabase Auth to validate the bearer token, so it works with the current ECC signing key setup.
4. Flask reads and writes application data using the Supabase service role key.
5. When a review is submitted, Flask sends the draft review to the Sentra Engine.
6. Sentra returns a score, label, status, and explainable flags.
7. Flask stores the review, flags, activity log, and updated reviewer trust score.
8. Admin users review flagged/quarantined content in the dashboard.
9. Customers can apply to become sellers through the same Supabase login.
10. Seller documents are uploaded by Flask to private Supabase Storage.
11. Admin users approve seller applications and seller products before public publishing.

## Risk Categories

- Text Risk: suspicious wording, duplicates, repetition, links, sentiment mismatch.
- Profile Risk: new accounts, incomplete profile, random usernames, no verified purchase.
- Behavior Risk: repeated reviews, review bursts, product review clusters.
- Rating Anomaly Risk: extreme rating bursts and new-account clusters.
- Seller Verification Risk: document completeness, profile completeness, contact mismatch, suspicious store naming, repeated payment details.
- Product Listing Risk: suspicious product copy, duplicate descriptions, unusual pricing, and rapid seller uploads.

## Seller Flow

1. Customer opens `/seller/apply` and submits seller details.
2. Flask stores the application, uploads documents, and calculates seller risk.
3. Admin opens `/admin/sellers`, reviews documents and Sentra reasons, then approves or rejects.
4. Approval creates a `sellers` row and updates `profiles.role` to `seller`.
5. Seller opens `/seller/dashboard`, submits products, and each product starts as `pending_review`.
6. Admin approves products from `/admin/products`; approved products become visible in the NovaMart catalog.

## Local Ports

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:5000`
- Supabase: hosted project dashboard
