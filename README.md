# Sentra: Fake Review & Fraudulent User Detection Framework

Sentra is an **explainable fraud and integrity detection system** built into a fully functional e-commerce marketplace called NovaMart. It provides a transparent, rule-based scoring engine that evaluates suspicious reviews, seller applications, product listings, user behavior, and rating anomalies.

Unlike black-box machine learning models, Sentra's engine uses named rules, visible score impacts, and human-readable reasons, making fraud detection completely explainable and actionable for moderators.

## ✨ Key Features

- 🏪 **Complete E-Commerce Workflows:** Full customer (browse, checkout, review) and seller (onboard, list products) experiences.
- 🔍 **Explainable Review Scoring:** Rule-based engine evaluates text risk, profile risk, behavioral anomalies, and device/network trust.
- 🛡️ **Seller & Product Integrity:** Scores seller trust during onboarding and flags suspicious product listings before they go public.
- 👨‍⚖️ **Admin Moderation Dashboard:** Comprehensive console for admins to inspect flagged content, view rule explanations, and manage users.
- 🚨 **Realtime Anomaly Detection:** Identifies rating bursts, multi-account devices, and verified purchase gaps.

## 🛠️ Technology Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Lucide-React, Recharts
- **Backend:** Python, Flask 3, PyJWT
- **Database & Platform:** Supabase (PostgreSQL, Auth, Storage, Realtime)

## 📂 Repository Structure

- `backend/`: Python Flask REST API, Sentra scoring engine, and core services.
- `frontend/`: Next.js web application for customers, sellers, and admins.
- `database/`: SQL schemas and seed data to initialize the Supabase project.
- `documentation/`: System architecture, API documentation, and testing plans.

## 🚀 Getting Started

### 1. Database Setup (Supabase)
1. Create a new Supabase project.
2. Run `database/schema.sql` in the SQL editor.
3. Review and run `database/seed_data.sql` to populate demo data.

### 2. Backend Setup
Navigate to the backend directory, create a virtual environment, and install dependencies:
```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
FLASK_ENV=development
FLASK_DEBUG=1
APP_ORIGIN=http://localhost:3000
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Run the API:
```bash
python run.py
```

### 3. Frontend Setup
Navigate to the frontend directory and install dependencies:
```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend/` directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=http://127.0.0.1:5000/api
```

Start the development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to access the marketplace.