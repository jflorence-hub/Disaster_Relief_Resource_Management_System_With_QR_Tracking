# Disaster Relief Resource Management System (with QR Tracking)

A Laravel + Inertia.js + React application implementing the 9 modules from
the "Disaster Relief Modules and Functionalities" specification, backed by
a real MySQL database (`laravel`) with full Create/Read/Update/Delete for
every module.

## Stack

- **Backend:** Laravel 13 (MVC), MySQL
- **Frontend:** React 19 + TypeScript, Inertia.js
- **Styling:** Tailwind CSS v4
- **QR:** `qrcode.react` (generation) + `html5-qrcode` (camera scanning)

## Modules implemented

1. **User Authentication** — login, logout, self-service registration (new
   accounts default to Staff-level access), and role-based access control
   (Administrator / Staff). Administrators can also add accounts directly
   via Team Management.
2. **Dashboard** — resource/location/distribution/scan statistics, recent
   activity feeds, low-stock alerts, quick-action shortcuts.
3. **Resource Management** — full CRUD, search & category/location filters,
   auto-generated SKU, computed stock status (in stock / low / out).
4. **QR Code Tracking** — auto-generated QR code per resource (viewable &
   downloadable as PNG), **live camera scanning** (`html5-qrcode`) or manual
   selection, scan history with resource movement (location updates on
   scan). Each scan can optionally record which **recipient/family** it was
   for (shown as its own column in the scan history table).
5. **Distribution Management** — search by recipient/family name; record
   deliveries with status Pending → In Transit → Completed → Cancelled;
   completing a distribution auto-deducts stock, reversing it restores
   stock. Resources are picked via a **category-first selector** (Food,
   Drinks, Medicine, Clothes, Tool, Hygiene, Set, Shelter, Other) — pick a
   category, then the matching resources appear. An **optional additional
   resource** (with its own quantity) can be added for emergencies, e.g. a
   family with a sick member requesting extra medicine — the Resource and
   Quantity columns show both items together. Every distribution record
   gets its own **unique, auto-generated QR code** the moment it's saved,
   viewable/downloadable per row, so a family's relief record can be
   checked before handing out more aid.
6. **Team Management** *(admin only)* — register/update personnel accounts,
   role (Administrator/Staff), status (Active/On Leave/Inactive),
   responsibilities, assigned location.
7. **Location Management** — register/update relief locations, operational
   status (Active/Inactive/Under maintenance), resource delivery summary
   per location (items stocked, deliveries completed, beneficiaries
   served).
8. **Reports** — inventory, distribution, and QR-tracking reports on
   screen, each with a **CSV export** button; low-stock watchlist,
   category/monthly/location breakdowns.
9. **System Settings** *(admin only)* — manage system settings (app name,
   org contact info, default low-stock threshold), manage user accounts
   (via Team Management), and **backup & restore data** (downloadable ZIP
   backup of all tables; upload to restore).

## Project structure (MVC)

```
app/
  Models/            Location, Resource, Distribution, QrScan, Setting, User
  Http/Controllers/  Dashboard, Location, Resource, Distribution,
                      QrTracking, Team, Report, Setting, Auth/*
  Http/Middleware/   EnsureUserIsAdmin (role-based access control)
database/
  migrations/        locations, resources, distributions, qr_scans,
                      settings, users (+role/status/phone/location)
  seeders/           DatabaseSeeder — realistic sample data
resources/js/
  pages/             one Inertia page per screen
  layouts/           AppLayout (role-aware sidebar/topbar)
  components/        Modal, ConfirmDialog, CameraScanner
routes/web.php       all CRUD + auth + admin-only routes
```

## Setup

### 1. Requirements

- PHP 8.3+ with the **zip** extension enabled (required for backup/restore)
- Composer
- MySQL 8+ (or MariaDB)
- Node.js 20+
- A browser with camera access for QR scanning (HTTPS or localhost — most
  browsers block camera access on plain HTTP from a network IP)

### 2. Install dependencies

```bash
composer install
npm install
```

### 3. Configure the database

`.env` is already set up for MySQL with a database named **`laravel`**:

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=
```

Adjust `DB_USERNAME` / `DB_PASSWORD` for your local MySQL setup, then create
the database:

```bash
mysql -u root -p -e "CREATE DATABASE laravel"
```

**Prefer MySQL Workbench?** A standalone `database_schema.sql` script is
also provided — open Workbench, connect to your server, `File → Open SQL
Script` → select it → click the lightning-bolt **Execute** icon. It creates
every table (with the same columns `php artisan migrate` would produce)
and seeds one admin account. Use this instead of steps 4–5 below if you'd
rather manage the schema visually in Workbench than through Artisan.

### 4. Migrate and seed

```bash
php artisan migrate --seed
```

This creates all tables and seeds realistic sample data: 5 locations, 7 user
accounts, 15 resources, 25 distributions, 30 QR scan records, and default
system settings.

### 5. Run the app

```bash
composer run dev
```

This runs the Laravel server, queue listener, and Vite dev server together.
Visit **http://localhost:8000**.

Or run separately:

```bash
php artisan serve
npm run dev
```

### 6. Log in

- **Administrator:** `admin@disasterrelief.test` / `password`
- **Staff:** `maria.santos@disasterrelief.test` / `password` (any seeded
  staff account — same password)

Administrators see all 9 modules. Staff accounts see everything except
**Team Management** and **Settings**.

## Production build

```bash
npm run build
```

## Mobile scanner app (Flutter)

A companion Flutter app (separate download) lets field staff scan resource
QR codes with a phone camera instead of the browser. It talks to a small
token-based JSON API added to this backend:

| Endpoint              | Method | Purpose                                      |
|------------------------|--------|-----------------------------------------------|
| `/api/login`            | POST   | Exchange email/password for a bearer token    |
| `/api/me`                | GET    | Current authenticated user                    |
| `/api/logout`            | POST   | Invalidate the current token                  |
| `/api/qr/lookup`         | POST   | Look up a resource by scanned QR code         |
| `/api/qr/scan`           | POST   | Record a scan (same effect as the web version)|
| `/api/qr/scans`          | GET    | Recent scan history                           |
| `/api/locations`         | GET    | Active/maintenance locations for the picker   |

Authentication is a lightweight custom bearer-token scheme (a hashed
`api_token` column on `users`) rather than Laravel Sanctum, so no extra
Composer package is required — `php artisan migrate` already creates the
column via `2026_08_23_000001_add_api_token_to_users_table`.

**Because the mobile app writes to the same database**, any scan it
records appears in the admin web app automatically. The QR Tracking page
polls every 15 seconds and the Dashboard every 20 seconds
(`router.reload({ only: [...] })`), so no manual refresh is needed — a
scan from the phone shows up in the browser shortly after.

See the Flutter project's own README for setup (`flutter create .`,
camera permissions, pointing it at this backend's URL).

## Notes on functionality

- **Stock logic:** completing a distribution deducts the quantity from the
  linked resource; cancelling/deleting a completed one restores it. QR
  scans adjust stock directly via "quantity change" and can also move a
  resource to a new location.
- **QR scanning (web):** click "Record Scan" → "Start camera" to scan with
  your device's camera, or use the dropdown to select a resource manually
  if no camera is available. Camera access requires browser permission.
- **QR scanning (mobile):** the Flutter app scans with the phone's native
  camera and posts directly to `/api/qr/scan` — see "Mobile scanner app"
  above.
- **Backup & Restore:** Settings → Backup & Restore. "Create Backup"
  packages all data into a downloadable `.zip`. Restoring replaces all
  current data — a confirmation step is required before it runs.
- **CSV exports:** Reports page has one-click CSV downloads for Inventory,
  Distribution, and QR Tracking reports.
- **Distribution search:** the Distribution page's search box matches
  recipient name, recipient contact, or the distribution's own QR code.
- **Additional (emergency) resource:** when recording a distribution, the
  "Add an additional resource for this family (optional)" checkbox reveals
  a second category → resource → quantity picker, entirely optional. The
  table's Resource and Quantity columns show the primary item with the
  additional one listed underneath (in purple) when present.
- **Distribution QR codes:** every distribution gets a unique QR code the
  moment it's created (existing seeded records were backfilled too). Click
  the QR icon on any row to view/download it — a practical way to keep a
  per-family paper or phone record to check against before future
  distributions.
- All delete actions show a confirmation dialog first.
