# Sentra API Endpoints

Base URL: `http://127.0.0.1:5000/api`

Protected endpoints require:

```http
Authorization: Bearer <supabase-access-token>
```

## Auth

- `POST /auth/sync-profile`
- `GET /auth/me`
- `PATCH /auth/me`

## Products

- `GET /products`
- `GET /products/:id`
- `POST /products` admin
- `PUT /products/:id` admin
- `DELETE /products/:id` admin

Public product reads return approved products only. Seller-submitted products remain private until admin approval.

## Cart and Orders

- `GET /cart`
- `POST /cart/items`
- `PUT /cart/items/:id`
- `DELETE /cart/items/:id`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`

## Reviews and Comments

- `POST /products/:id/reviews`
- `GET /products/:id/reviews`
- `POST /reviews/:id/comments`
- `GET /reviews/:id/comments`

## Admin

- `GET /admin/dashboard`
- `GET /admin/reviews/flagged`
- `GET /admin/users/suspicious`
- `GET /admin/products/anomalies`
- `GET /admin/reviews/:id/risk-report`
- `POST /admin/reviews/:id/approve`
- `POST /admin/reviews/:id/reject`
- `POST /admin/reviews/:id/quarantine`
- `GET /admin/moderation-logs`
- `GET /admin/activity-logs`

## Seller Applications

- `POST /seller/apply`
- `GET /seller/application`
- `POST /seller/documents`
- `GET /seller/me`

Seller document uploads are sent to the private Supabase Storage bucket `seller-documents` through Flask. The frontend never receives the service role key.

## Seller Dashboard

- `GET /seller/dashboard`
- `GET /seller/products`
- `POST /seller/products`
- `PUT /seller/products/:id`
- `DELETE /seller/products/:id`
- `GET /seller/orders`
- `GET /seller/reviews`
- `GET /seller/sentra-alerts`

Seller-created products start with `approval_status = pending_review`.

## Admin Seller Verification

- `GET /admin/seller-applications`
- `GET /admin/seller-applications/:id`
- `POST /admin/seller-applications/:id/approve`
- `POST /admin/seller-applications/:id/reject`
- `POST /admin/seller-applications/:id/request-changes`
- `GET /admin/seller-documents/:id/download`
- `GET /admin/products/pending`
- `POST /admin/products/:id/approve`
- `POST /admin/products/:id/reject`
