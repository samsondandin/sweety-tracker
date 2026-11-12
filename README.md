# Sweety — Enterprise Blood Glucose Tracker & Clinical Reporting Engine

An enterprise-grade, privacy-first blood glucose tracking journal and clinical reporting platform re-architected with **Node.js, Express, PostgreSQL, and React (Vite + TypeScript)**.

---

## 1. Architecture Overview

Sweety is organized as a modular monorepo cleanly separating frontend presentation from backend domain logic, database migrations, and testing infrastructure:

```
sweety/
├── client/                     # React 19 Frontend SPA (Vite + TypeScript + Tailwind CSS)
│   ├── src/
│   │   ├── api/                # Typed REST API clients (client, auth, readings, reports)
│   │   ├── components/         # Clean UI components & modals (Reading, Delete, Profile, TrendChart)
│   │   │   └── ui/             # Radix UI primitives (Button, Dialog, Select, Avatar, Alert, Input, Label)
│   │   ├── context/            # Authentication Context & Session State
│   │   ├── lib/                # Domain utilities, date formatters, client-side validation logic
│   │   └── test/               # React Testing Library test suites (ReadingDialog validation)
│   ├── index.html              # Clean SPA entrypoint (zero AI-builder watermarks or third-party tracking)
│   └── vite.config.ts          # Vite configuration with React and Tailwind v4 plugins
│
├── server/                     # Node.js + Express REST API Backend
│   ├── src/
│   │   ├── config/             # PostgreSQL connection pool (pg) & Zod environment schema
│   │   ├── controllers/        # Express Route Handlers (Auth, Readings, Reports)
│   │   ├── middleware/         # JWT verification, Zod schema validator, Centralized error handler
│   │   ├── routes/             # REST route declarations (/api/auth, /api/readings, /api/reports)
│   │   ├── services/           # Business logic, statistical report queries, and data validation
│   │   └── db/                 # PostgreSQL schema migrations (schema.sql), migration runner, seed script
│   └── tests/                  # Integration & unit test suites (Vitest + Supertest + pg-mem)
│
├── docker-compose.yml          # Multi-container orchestration (PostgreSQL 16 + Express API)
├── package.json                # Root orchestration workspace scripts
└── .env.example                # Environment configuration templates (root, server, client)
```

---

## 2. Tech Stack Decisions

| Layer | Technology | Decision Rationale |
|---|---|---|
| **Backend Runtime** | Node.js (v20+) & Express 4 | Lightweight, high-throughput REST API with battle-tested middleware ecosystem. |
| **Language** | TypeScript 5 (Strict) | End-to-end type safety across domain models, API DTOs, and component props. |
| **Database** | PostgreSQL 16 | Relational consistency, composite unique constraints (`user_id`, `reading_date`, `time_slot`), index-backed date-range scans, and transactional integrity. |
| **Database Access** | Native `pg` Connection Pool | Direct SQL control without ORM overhead, zero memory leaks, and transparent connection lifecycle management. |
| **Authentication** | JWT + bcrypt (10 rounds) | Stateless Bearer token & HTTP-only cookie support with secure salted password hashing. |
| **Frontend Framework** | React 19 + Vite | Instant HMR, minimal bundle overhead, and component architecture. |
| **Styling** | Tailwind CSS v4 | CSS variable design tokens (`oklch`) matching clinical typography and palettes. |
| **Visualizations** | Recharts | Responsive SVG charts for visualizing monthly glucose trends and trajectories. |
| **Validation** | Zod | Runtime schema validation on API request boundaries, coupled with shared client rules. |
| **Testing** | Vitest, Supertest, RTL, pg-mem | Fast in-memory integration testing of SQL queries and UI forms without external daemon lock-in. |

---

## 3. Prerequisites

- **Node.js**: `v20.x` or `v22.x` (or newer)
- **npm**: `v10.x` or newer
- **Docker & Docker Compose** (Optional, for containerized execution)
- **PostgreSQL 16** (Optional, if running database directly on host or using Neon / Supabase / AWS RDS)

---

## 4. Quick Start: Local Setup

### Option A: Using Docker Compose (Single Command)

Spins up PostgreSQL 16 and builds the Express server:

```bash
docker compose up --build -d
```

- PostgreSQL runs on `localhost:5432` with database `sweety`.
- Express REST API runs on `http://localhost:5000`.
- Health check available at `http://localhost:5000/api/health`.

To start the Vite frontend locally:

```bash
cd client
npm run dev
```

Navigate to `http://localhost:5173`.

---

### Option B: Manual Local Setup (Local Postgres or Neon)

#### 1. Configure Environment Files

Create the local `.env` files from their respective `.env.example` templates:

```bash
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Ensure `server/.env` contains your active PostgreSQL connection URL:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sweety
PORT=5000
JWT_SECRET=super_secret_jwt_key_sweety_2026
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

And `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

#### 2. Run Database Migrations

Applies the SQL schema, composite constraints, and daily-reading triggers:

```bash
npm run migrate
```

#### 3. Seed Realistic Demo Data

Populates the default demo account with 45 days of blood glucose readings spanning the current and previous months:

```bash
npm run seed
```

Demo account credentials:
- **Email**: `demo@sweety.app`
- **Password**: `Demo@1234`

#### 4. Start Development Servers

Run both backend and frontend concurrently:

```bash
npm run dev
```

Or run them individually in separate terminals:

```bash
# Terminal 1 - Backend API (port 5000)
npm run dev:server

# Terminal 2 - Frontend UI (port 5173)
npm run dev:client
```

---

## 5. API Specification & Validation Rules

### Authentication Endpoints

- `POST /api/auth/register` — Registers a user with `name`, `email`, and `password` (minimum 8 characters). Issues a JWT and HTTP-only cookie.
- `POST /api/auth/login` — Authenticates credentials and returns user profile and JWT.
- `POST /api/auth/logout` — Clears authentication cookies.
- `GET /api/auth/me` — Returns the authenticated user and clinical profile (requires Bearer token).
- `PUT /api/auth/profile` — Updates `full_name`, `display_name`, and `timezone`.

### Glucose Readings Endpoints

- `GET /api/readings?page=1&limit=20` — Returns paginated readings for the authenticated user ordered by `reading_date DESC, created_at DESC`.
- `POST /api/readings` — Records a new reading.
- `PUT /api/readings/:id` — Updates an existing reading.
- `DELETE /api/readings/:id` — Deletes a reading.

#### Exact Validation Error Messages

| Condition | HTTP Status | Returned Error Message |
|---|---|---|
| Missing value | `400 Bad Request` | `"Please enter a glucose value."` |
| Value `< 40`, `> 600`, or non-integer | `400 Bad Request` | `"Value must be between 40 and 600 mg/dl."` |
| Slot already recorded on date | `409 Conflict` | `"You already have an [Slot Name] reading for this date."` |
| Attempting 5th reading on same date | `400 Bad Request` | `"You can add only 4 readings per day."` |
| Date set in the future | `400 Bad Request` | `"Date cannot be in the future."` |

### Reporting Engine Endpoint

`GET /api/reports?date=YYYY-MM-DD`

Given a selected anchor date (e.g. `2026-10-15`), the engine computes three distinct clinical horizons:

1. **Daily (`15 Oct 2026`)**:
   - `highest`, `lowest`, `average` (rounded to 1 decimal place), and `count`.
   - Full list of readings recorded on this date with their time slots.
2. **Month-to-Date (`1 Oct – 15 Oct 2026`)**:
   - `highest`, `lowest`, `average` (1 decimal), and `count`.
   - Array of daily averages for trend charts.
3. **Monthly / Previous Month (`1 Sep – 30 Sep 2026`)**:
   - Calendar month prior to selected date's month.
   - `highest`, `lowest`, `average` (1 decimal), and `count`.
   - Array of daily averages for trend charts.
4. **Zero Readings / Empty State**:
   - Gracefully returns `{ highest: null, lowest: null, average: null, count: 0 }`.

---

## 6. Running Test Suites

Both frontend and backend are equipped with automated test suites:

### Backend Tests (Vitest + Supertest + in-memory Postgres)

Validates auth flows, strict validation rules, 409 conflict responses, 4-per-day limits, and report math:

```bash
npm run test:server
```

### Frontend Tests (Vitest + React Testing Library + JSDOM)

Validates Reading Dialog client-side error assertions and form interaction:

```bash
npm run test:client
```

### Full Test Suite Run

```bash
npm test
```

---

## 7. Engineering Notes & Trade-offs

### Timezone Handling for Date Boundaries
- **The Challenge**: Using raw UTC `new Date().toISOString().slice(0, 10)` causes false rejections when users in positive UTC offsets (e.g., UTC+10 to UTC+12 in Asia-Pacific) log readings in their local morning, because the UTC date is still yesterday. Conversely, users in negative offsets (e.g., UTC-8 in the Americas) might be allowed to log tomorrow's date if evaluated in UTC.
- **Our Solution**: Sweety allows the client to send an `X-Timezone` header (automatically resolved via `Intl.DateTimeFormat().resolvedOptions().timeZone`), falling back to the user's saved profile timezone. The server evaluates `today` within that specific IANA timezone before performing the `reading_date > today` comparison, ensuring accurate, timezone-aware validation across all latitudes.

### Database Constraint & Advisory Locking
- Daily limit enforcement (maximum 4 readings per date per user) is enforced both at the application validation layer and in a PostgreSQL trigger (`check_daily_reading_limit`).
- Duplicate slots are guarded by a composite unique constraint `UNIQUE(user_id, reading_date, time_slot)` with an index on `(user_id, reading_date DESC)` to optimize report range scans.

### Single-Query Report Aggregation
- Rather than executing 3 separate roundtrips for Daily, Month-to-Date, and Previous Month data, the report engine computes the date bounds and queries PostgreSQL in a single indexed scan spanning the start of the previous month to the anchor date. Metrics are partitioned and calculated in memory, minimizing database latency.

---

## 8. Future Roadmap

1. **Redis Cache Invalidation**: Implement Redis caching for historical monthly reports (`/api/reports?date=...`), with automatic invalidation keys when a user modifies or inserts readings within that month.
2. **Role-Based Access Control (RBAC)**: Support Doctor/Clinician roles to permit authenticated care providers to review patient journals and export annotated PDF reports.
3. **Continuous Glucose Monitor (CGM) Ingestion**: Support background webhook ingestion from continuous glucose monitors (Dexcom, FreeStyle Libre) with automated bucket aggregation.
