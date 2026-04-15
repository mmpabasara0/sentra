# Sentra Testing Plan

## Setup

1. Create a Supabase project.
2. Run `database/schema.sql` in the Supabase SQL editor.
3. Create demo users in Supabase Auth.
4. Replace placeholder `auth_user_id` values in `database/seed_data.sql`.
5. Run `database/seed_data.sql`.
6. Copy `.env.example` files to `.env.local` and `.env`.

## Demo Scenarios

### Genuine Review

- Log in as a normal customer.
- Buy a product through cart and checkout.
- Submit a detailed review.
- Expected result: low risk score and `published` status.

### Suspicious Review

- Log in as a new/incomplete account.
- Submit `good product` with a 5-star rating and no purchase.
- Expected result: `Suspicious`, `flagged`, with generic review and no verified purchase reasons.

### High-Risk Review

- Submit repeated promotional text such as `Amazing amazing amazing must buy best ever guaranteed perfect item!!!`.
- Expected result: `High Risk`, `quarantined`, with repeated words, marketing language, and profile risk flags.

### Admin Moderation

- Log in as an admin.
- Open `/admin/dashboard`.
- Review the moderation queue.
- Approve, reject, or quarantine a review.
- Expected result: moderation log is written and reviewer trust score is recalculated.

### Seller Application

- Log in as a customer.
- Open `/seller/apply`.
- Confirm that name, email, phone, and address are prefilled when available.
- Submit store details, bank/payment summary, NIC, and utility bill.
- Expected result: application is `pending`, documents are stored in `seller-documents`, and Sentra shows seller risk reasons.

### Seller Approval

- Log in as an admin.
- Open `/admin/sellers`.
- Inspect the seller application and uploaded documents.
- Approve the seller.
- Expected result: a `sellers` row is created, the profile role becomes `seller`, and the account menu shows `Switch to seller`.

### Seller Product Approval

- Switch to seller studio.
- Add a product from `/seller/products/new`.
- Expected result: product is `pending_review` and does not show in public `/products`.
- Open `/admin/products` as admin and approve the product.
- Expected result: the product appears in the public store.

### Seller Integrity Signals

- Submit a product with a very short description or unrealistic price.
- Expected result: Sentra product screening adds risk reasons in seller and admin product views.
- Submit many seller products quickly from a new seller.
- Expected result: bulk upload/new seller behavior appears as a seller/product risk signal.

## Verification Commands

Frontend:

```bash
cd frontend
npm run build
```

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```
