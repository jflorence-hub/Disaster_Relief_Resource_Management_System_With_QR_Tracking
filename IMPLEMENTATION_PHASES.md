# Implementation Phases

**Project:** Disaster Relief Resource Management System  
**Systems:** Laravel Backend · Staff Flutter App · Family Flutter App · Admin Web Panel  
**Based on:** FEATURE_PLAN.md (Features 1–8)

---

## Reading guide

Each phase lists its deliverables grouped by system. Phases are ordered so that each one only depends on work completed in earlier phases. **Phase 1 must be completed before any other phase begins** because it provides the database foundation everything else builds on.

---

## Phase 1 — Database Foundations

**Goal:** Run all migrations so every subsequent phase can be developed and tested against a stable schema.

### Migrations (in order)

| # | Migration file | What it adds |
|---|---|---|
| 1 | `add_location_id_to_puroks_table` | `location_id` FK on `puroks` → `locations` |
| 2 | `add_captain_fields_to_locations_table` | `captain_name`, `captain_contact`, `captain_email` on `locations` |
| 3 | `add_staff_profile_fields_to_users_table` | `staff_id` (unique string), `birthdate` (date nullable), `home_address` (text nullable) |
| 4 | `create_resource_sets_table` | `id`, `name`, `description`, `location_id`, `disaster`, `created_by`, `timestamps` |
| 5 | `create_resource_set_items_table` | `id`, `resource_set_id`, `resource_id`, `quantity`, `timestamps` |
| 6 | `create_distribution_items_table` | `id`, `distribution_id`, `resource_id`, `quantity`, `timestamps` (for individual-item mode) |
| 7 | `add_excluded_fields_to_distributions_table` | `excluded` (boolean, default false), `exclusion_reason` (string nullable) |
| 8 | `add_resource_set_id_to_distributions_table` | `resource_set_id` (nullable FK → `resource_sets`) |

### Models to update
- `Purok` — add `belongsTo(Location)` relationship
- `Location` — add `captain_name`, `captain_contact`, `captain_email` fillable fields; add `hasMany(Purok)`, `hasMany(Family)` relationships
- `User` — add `staff_id` fillable; add `StaffIdObserver` (see Phase 3)
- `Distribution` — add `excluded`, `exclusion_reason`, `resource_set_id` fillable; add `belongsTo(ResourceSet)` and `hasMany(DistributionItem)` relationships
- Create `ResourceSet` model with `hasMany(ResourceSetItem)` and `belongsTo(Location)`
- Create `ResourceSetItem` model with `belongsTo(Resource)` and `belongsTo(ResourceSet)`
- Create `DistributionItem` model with `belongsTo(Resource)` and `belongsTo(Distribution)`

**Exit criteria:** `php artisan migrate` runs without errors on a clean database. All model relationships resolve without exceptions.

---

## Phase 2 — Critical Bug Fix: QR Scan → Distribution Completion

> Moved to Phase 2 because this is the highest-priority functional bug in the system.

**Goal:** Scanning a QR code must atomically complete the distribution record, prevent re-scanning, and update the family app's status.

### Backend
- **Update `POST /qr/scan`** (when `scan_type = 'completed'`):
  1. Wrap everything in `DB::transaction()`.
  2. Find the family's pending distribution for the current schedule.
  3. Check for duplicate: existing `QrScan` with `scan_type = 'completed'` for this schedule, OR distribution already `status = 'completed'`. If duplicate → return HTTP 409 with `{ message, family_name, claimed_at, claimed_by }`.
  4. Update distribution `status = 'completed'`, `claimed_by = receiver`.
  5. Call `applyStock()` to deduct inventory.
  6. Save the `QrScan` record.
- **Update `POST /qr/scan`** — respect `excluded` flag: if the family's distribution has `excluded = true`, return HTTP 403 with message "This family is excluded from this distribution schedule."
- Deprecate `/distributions/confirm` for the staff scan flow (keep the endpoint but mark it as redundant in comments).

### Staff Flutter App
- **`ScanPage`**: handle HTTP 409 → show a modal dialog:
  - Title: "Already Claimed"
  - Body: "[Family Name] already received their relief goods on [date] at [time], claimed by [receiver name]."
  - Single "OK" button to dismiss.
- **`ScanPage`**: handle HTTP 403 (excluded) → show a modal:
  - Title: "Family Excluded"
  - Body: "This family is excluded from this distribution. Reason: [exclusion_reason or 'No reason provided']."

### Family Flutter App
- **`UpcomingDistributionPage`**: if `distribution.excluded == true`, show an "Excluded" status chip with `exclusion_reason` subtitle instead of the normal pending card.

**Exit criteria:** Scanning a valid QR updates the distribution status to `completed`. Scanning the same family twice returns 409 and the staff app shows the modal. The family app reflects the correct status after a scan.

---

## Phase 3 — Staff ID Auto-Generation

**Goal:** Every staff account (new registrations approved by admin + accounts created directly by admin) gets a unique `STAFF-XXXXXX` identifier with a randomly generated 6-digit suffix.

### Backend
- Create a `StaffIdObserver` (or a `generating` trait) that fires on `User::creating`:
  ```php
  do {
      $candidate = 'STAFF-' . str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  } while (User::where('staff_id', $candidate)->exists());
  $user->staff_id = $candidate;
  ```
- Register the observer in `AppServiceProvider`.
- Add a unique index on `users.staff_id` (already included in Phase 1 migration — this step is just a verification checkpoint).

### Admin Web Panel
- Display `staff_id` in the Staff Management table as a column.
- Display `staff_id` on the staff profile/detail view.

**Exit criteria:** Every new user created (via registration approval or admin manual creation) has a unique `staff_id` matching the pattern `STAFF-\d{6}`. Attempting to create two users simultaneously never produces a duplicate (unique DB constraint is the safety net).

---

## Phase 4 — Staff Registration Improvements (Features 1, 2, 3)

**Goal:** Registration form shows only valid, available puroks filtered by location; passwords have a strength indicator and complexity enforcement.

> Requires Phase 1 (location_id on puroks).

### Backend
- **`GET /puroks`**: update to:
  - Only return locations with `status = 'active'`.
  - For each purok, include `is_occupied` (true if `assigned_staff_id` points to a user with `status = 'active'`).
  - Accept optional `?location_id=` query parameter to filter puroks to a specific location.
- **`POST /register`**: add server-side validation:
  - `location_id` must exist in `locations` AND have `status = 'active'`.
  - `purok_id` must not be occupied (re-check at save time to prevent race conditions).
- **Password validation**: add regex rule requiring at least one uppercase letter, one number, and one special character.

### Staff Flutter App — `RegisterPage`
- After a location is selected, re-fetch puroks filtered by `?location_id=` and rebuild the purok dropdown.
- Puroks with `is_occupied = true` are rendered in the list as disabled (greyed-out text + "Already assigned" label).
- If all puroks under the selected location are occupied, show inline message: "All puroks currently have assigned staff. Contact the administrator."
- Add note under location dropdown: "Only locations currently accepting staff applications are shown."
- Add a password strength bar below the password field:
  - **Weak** — length < 8 or only one character type
  - **Medium** — length ≥ 8, two character types
  - **Strong** — length ≥ 10, three or more character types (uppercase + number + special)

**Exit criteria:** Occupied puroks cannot be selected. Submitting a registration with an occupied purok returns a validation error. Password strength bar updates as the user types.

---

## Phase 5 — Admin: Manually Create a Staff Account (Feature 4)

**Goal:** Admin can create an active staff account directly from the admin panel without the self-registration + approval flow.

> Requires Phase 3 (staff_id auto-generation) and Phase 1 (location_id on puroks).

### Backend
- **`POST /admin/staff`**: create a `User` with:
  - `status = 'active'`
  - `must_change_password = true`
  - `role = 'staff'`
  - `staff_id` auto-generated via observer (Phase 3)
  - Update `puroks.assigned_staff_id` to the new user's ID.
  - Send a welcome email with the temporary password.
- **`GET /admin/staff`**: list staff with filters (status, location, purok).
- **`PATCH /admin/staff/{user}`**: update staff details.
- **`DELETE /admin/staff/{user}`**: deactivate staff — set `status = 'inactive'`, clear `puroks.assigned_staff_id` for their assigned purok (makes the purok available again).

### Admin Web Panel
- Add "Add Staff" button to the Staff Management section.
- Modal/drawer form with fields: first name, last name, email, phone, birthdate, home address, assigned location, assigned purok, temporary password.
- After creation, the new staff row appears immediately in the active staff list with their `staff_id` displayed.
- Deactivate action clears the purok assignment (purok becomes available).

**Exit criteria:** Admin creates a staff account; the account is immediately active; the assigned purok is no longer available in the registration form; a welcome email is sent with the temporary password.

---

## Phase 6 — Bulk Family Import (Feature 6)

**Goal:** Admin uploads an Excel/CSV file to bulk-create family records. The file includes barangay metadata at the top. If the barangay doesn't exist, it is auto-created. Families panel and Distribution panel gain a barangay filter.

> Requires Phase 1 (captain fields on locations, location_id on puroks).

### Backend
- Install `maatwebsite/excel` (Laravel Excel) if not already present.
- **`POST /admin/families/import`**:
  1. Parse the 4 header rows: Barangay Name, Barangay Captain Name, Barangay Captain Contact, Barangay Captain Email.
  2. Look up `locations` by `name` (case-insensitive). If not found, auto-create with `status = 'active'` and the 4 header values.
  3. Parse data rows. Columns expected: `head_firstname`, `head_lastname`, `household_members` (comma-separated names), `purok`, `phone` (optional), `email` (optional).
  4. For each row:
     - Validate required fields.
     - Match `purok` to puroks under the resolved location.
     - Check for duplicate head name.
     - Generate `family_id` (FAM-XXXXX).
     - Create `Family` with `status = 'active'`, PIN generated.
     - Split `household_members` by comma, trim, create one `HouseholdMember` per name.
  5. Return `{ imported, skipped, errors: [{ row, reason }] }`.
- Provide a downloadable template endpoint: `GET /admin/families/import/template`.

### Admin Web Panel
- "Import Families" button in the Families section.
- File upload dialog with "Download Template" link.
- Preview table showing parsed rows (head name, purok, member count, errors highlighted in red) before confirming.
- After confirmation, display the import summary: success count, skipped count, error rows with reasons.
- **Barangay filter** added to the Families panel table — dropdown defaulting to "All Barangays".
- **Barangay filter** added to the Distribution panel table — dropdown defaulting to "All Barangays".

**Exit criteria:** Uploading a valid file creates families and (if needed) auto-creates the location. The preview shows correct parsed data. Rows with invalid puroks appear as errors and are skipped. Families are visible in both panels, filterable by barangay.

---

## Phase 7 — Resource Sets + Distribution Assignment (Feature 7)

**Goal:** Admin can create named resource sets (bundles). When scheduling a distribution, they can assign either a set or individual items.

> Requires Phase 1 (resource_sets, resource_set_items, distribution_items tables).

### Backend
- **`GET /admin/resource-sets`** — list sets with expanded items.
- **`POST /admin/resource-sets`** — create set; body: `{ name, description, location_id, disaster, items: [{ resource_id, quantity }] }`.
- **`GET /admin/resource-sets/{id}`** — full contents.
- **`PUT /admin/resource-sets/{id}`** — update set and its items.
- **`DELETE /admin/resource-sets/{id}`** — delete set (block if any active distributions reference it).
- **Update distribution create/edit endpoints**:
  - Accept `assignment_mode`: `'set'` or `'individual'`.
  - If `'set'`: accept `resource_set_id`.
  - If `'individual'`: accept `items: [{ resource_id, quantity }]` → write to `distribution_items`.
  - In both modes, run the **stock sufficiency check**: for each resource × non-excluded family count vs. `resources.quantity`. Return warnings in the response; do not block save.

### Admin Web Panel
- **Resources section** — new "Sets" tab:
  - List of set cards showing name, item count, location, disaster tag.
  - "Create Set" button → form with checklist of resources, each with a quantity input.
  - Set card expands inline to show full item list.
- **Distribution create/edit form** — resource assignment section:
  - Toggle: **Assign a Set** / **Assign Individual Items**.
  - "Assign a Set" mode: searchable dropdown of sets.
  - "Assign Individual Items" mode: checklist of resources with quantity inputs.
  - After selecting, show a stock warning banner if any resource is insufficient.

**Exit criteria:** Admin creates a set; the set appears in the Sets tab. Creating a distribution with a set or individual items saves correctly. Insufficient stock shows a warning but does not prevent saving.

---

## Phase 8 — Distribution Filters + Exclusion UI (Feature 8, UI portion)

**Goal:** Add filter tabs and exclusion controls to the Distribution panel (admin) and DistributionPage (staff app). The backend exclusion endpoints (depend on Phase 1 schema) are also completed here.

> Requires Phase 2 (excluded flag is in use) and Phase 1 (excluded columns exist).

### Backend
- **`POST /admin/distributions/{id}/exclude`**: set `excluded = true`, `exclusion_reason = request.reason`. Validate that the distribution is not already completed.
- **`POST /admin/distributions/{id}/include`**: set `excluded = false`, clear `exclusion_reason`.
- **Update `GET /admin/distributions`**: accept `?status=` and `?barangay_id=` query parameters for server-side filtering.

### Admin Web Panel — Distribution panel
- **Barangay filter** (already added in Phase 6 for the table; this phase connects it to the API `?barangay_id=` param).
- **Status filter tabs** at the top of the distribution table: All / Pending / Completed / Excluded.
- Each family row in "Pending" status has an "Exclude" action button → opens a small modal to optionally enter an exclusion reason.
- Excluded rows show an "Excluded" badge and an "Include" button to reverse.

### Staff Flutter App — `DistributionPage`
- Replace the existing static status chips with **tappable filter buttons** at the top of the list: All / Pending / Completed / Excluded.
- Tapping a filter re-fetches or filters the local list by that status.
- Excluded families do not appear in the default "Pending" view.

**Exit criteria:** Admin can exclude a family from a distribution; the family disappears from the staff's pending scan queue; excluded families appear in the "Excluded" filter tab on both admin and staff views. Re-including restores them to the pending queue.

---

## Dependency Map

```
Phase 1 (DB Foundations)
  └── Phase 2 (QR Scan Fix)          ← no DB deps beyond Phase 1
  └── Phase 3 (Staff ID)             ← needs staff_id column (Phase 1)
        └── Phase 4 (Registration)   ← needs location_id on puroks (Phase 1)
        └── Phase 5 (Manual Staff)   ← needs Phase 3 (staff_id observer)
  └── Phase 6 (Bulk Import)          ← needs captain fields + location_id (Phase 1)
  └── Phase 7 (Resource Sets)        ← needs resource_sets tables (Phase 1)
  └── Phase 8 (Filters + Exclusion)  ← needs excluded columns (Phase 1), scan fix (Phase 2)
```

Phases 2, 3, 4, 5, 6, 7, and 8 can be worked on in parallel once Phase 1 is complete, with the single constraint that Phase 5 waits for Phase 3, and Phase 8 waits for Phase 2.

---

## Quick Reference — Files Likely Touched Per Phase

| Phase | Laravel | Staff Flutter | Family Flutter | Admin Web |
|---|---|---|---|---|
| 1 | Migrations, Models | — | — | — |
| 2 | `QrScanController` | `ScanPage` | `UpcomingDistributionPage` | — |
| 3 | `StaffIdObserver`, `AppServiceProvider` | — | — | Staff table, profile view |
| 4 | `PurokController`, `RegisterController` | `RegisterPage` | — | — |
| 5 | `AdminStaffController` | — | — | Staff Management panel |
| 6 | `FamilyImportController`, Laravel Excel | — | — | Families panel, Distribution panel |
| 7 | `ResourceSetController`, Distribution endpoints | — | — | Resources section, Distribution form |
| 8 | `DistributionController` (exclude/include) | `DistributionPage` | — | Distribution panel |

---

---

## Phase 9 — Fix: QR Scan → Distribution Completion *(highest priority)*

**Root cause:** `POST /qr/scan` calls `QrTrackingController::store()` which only logs a QrScan record. It never touches the `distributions` table. The separate `POST /distributions/confirm` endpoint is what marks a distribution completed, but the scan page never calls it — the two are completely disconnected.

### Backend — `QrTrackingController::store()`
- Inside the existing `DB::transaction()`, after saving the `QrScan` record, look up the family's pending distribution:
  - Match on `family_id` + active schedule (latest `distribution_schedules` row or `schedule_id IS NULL`)
  - If the distribution has `excluded = true` → abort transaction, return HTTP 403 with `{ message, exclusion_reason }`
  - If the distribution is already `status = 'completed'` → abort transaction, return HTTP 409 with `{ message, already_completed: true, family_name, claimed_at, claimed_by }`
  - Otherwise → call `$distribution->applyStock()`, set `status = 'completed'`, save within the same transaction
- The `claimed_by` value should be set from the `receiver` field on the scan request

### What does NOT change
- The Flutter scan page already handles HTTP 409 ("Already Claimed" modal) and HTTP 403 ("Family Excluded" modal) — no Flutter changes needed
- The `/distributions/confirm` endpoint is kept but marked as deprecated in comments

### Exit criteria
Scanning a valid QR code marks the distribution as `completed` in the same request. Scanning the same family twice returns 409 and shows the "Already Claimed" modal. The distribution history on the Flutter app shows the correct `completed` status immediately after scan.

---

## Phase 10 — Fix: APP_URL + Admin Startup Script

**Root cause:** `.env APP_URL` is left pointing at the ngrok URL after a ngrok session. When running locally via `localhost:8000`, the session cookie domain mismatches and the role-gated features disappear.

### Scripts
- Update `start-admin.ps1` to:
  1. Read the current `APP_URL` from `.env` and save it
  2. Write `APP_URL=http://localhost:8000` into `.env` before starting servers
  3. Run `php artisan config:clear && php artisan cache:clear`
  4. On Ctrl+C or window close, restore the original `APP_URL`
- Update `start-ngrok-dev.ps1` to set `APP_URL` to the active ngrok tunnel URL after ngrok starts

### UTF-8 mojibake fix
- Re-save all PHP files that contain garbled `â€"` characters (em-dash mojibake) as UTF-8
- Affected files are controller files with comment separators using `─` or `—`

### Exit criteria
Running `.\start-admin.ps1` results in a fully functional admin panel at `http://localhost:8000` with all role-gated features visible. No manual `.env` edits required when switching between local and ngrok modes.

---

## Phase 11 — Fix: Barangay-Scoped Distribution Panel

**Root cause:** `DistributionController::index()` hard-scopes the `$families` prop to Main Warehouse regardless of the `location_id` filter. The stat cards and family rows all derive from this prop so they never reflect the selected barangay.

### Backend — `DistributionController::index()`
- When `location_id` is present in the request, scope `$families` to that location instead of Main Warehouse
- Pass a `locations` prop with all active locations so the frontend can populate the barangay dropdown
- The stat cards (Families, Pending, Completed) derive from the `families` prop — they update automatically once the prop is correctly scoped

### Admin Web Panel — `distribution.tsx`
- Remove the "Scanned By" column from the Current Relief Distribution table (scanned/completed families are hidden from pending view; the column is meaningless)
- Add a "Assign Resource to All" bulk action at the top of the distribution table:
  - Opens a modal to pick a resource set or individual items
  - Writes the same resource assignment to all pending, non-excluded families in one operation
  - Replaces the need to edit each family row individually

### Exit criteria
Selecting a barangay from the filter updates the family list, stat cards, and distribution rows to that barangay. The bulk-assign action sets a resource/set on all pending families in one click.

---

## Phase 12 — Fix: Schedule Barangay Scope + Cross-Barangay Staff Assignment

**Root cause 1:** Auto-creation of pending distribution rows in `index()` runs for all active families with no barangay scope. A new schedule intended for Barangay A creates rows for families in Barangay B and C too.

**Root cause 2:** The purok dropdown in staff assignment shows all puroks across all barangays. Phase 4 was designed to filter this but the frontend never received the filtered list.

### Backend
- Auto-creation of pending distribution rows in `index()` scoped to `location_id` (request filter) or defaults to Main Warehouse only — not all families system-wide
- `/puroks` endpoint: filter returned puroks to the `location_id` query parameter; mark each as `is_occupied`
- Staff assignment validation: `purok_id` must belong to the same `location_id` as the staff member's assigned location

### Admin Web Panel
- Purok dropdown in Team / Staff management filtered to the selected location
- Distribution family dropdown only shows families from the active location filter

### Exit criteria
Creating a schedule for Barangay A only creates distribution rows for Barangay A families. Staff cannot be assigned to a purok from a different barangay. The family dropdown in the schedule form is always barangay-scoped.

---

## Phase 13 — Fix: Family Import + Location Upsert

**Root cause:** `FamilyImportController` creates a new location if none exists, but when a location already exists it silently ignores the 4 header fields (captain name, contact, email, population). Puroks created during import do not always have their `location_id` set, causing cross-barangay assignment issues downstream.

### Backend — `FamilyImportController`
- **Existing location found:** update `captain_name`, `captain_contact`, `captain_email` from file headers; increment population count by the number of imported families
- **New location:** validate that all 4 header fields are present before proceeding; if any are missing, return a validation error prompting the admin to fill them in via a pre-import form step
- All puroks matched or created during import must have `location_id` set to the resolved location
- If a purok name from the file does not match any existing purok for that location, create it with the correct `location_id`

### Admin Web Panel
- Pre-import step: if the barangay name is new, show a form asking for captain name, contact, and email before the file rows are parsed
- If the barangay already exists, show a confirmation: "Barangay X found — captain info will be updated from the file. Continue?"

### Exit criteria
Importing a file for an existing barangay updates its captain fields. Importing for a new barangay requires and saves the 4 header fields. All imported families are correctly scoped to their barangay. Barangay filter in the Families panel works correctly after import.

---

## Phase 14 — Threshold as Soft Warning Only

**Root cause:** `minimum_threshold` on a resource is currently used as a hard gate in some paths and as a warning in others, creating inconsistent behavior. It should never block saving — it is only informational.

### Backend
- Remove any 422/block responses tied to `minimum_threshold` comparison in distribution and resource endpoints
- The stock sufficiency check (`checkStock`) returns warnings only — never errors
- Add a computed field to the resource response: `families_coverable` = `quantity / avg_quantity_per_family` where average is derived from registered families in associated barangays

### Admin Web Panel
- Threshold badge on resource card: amber pill "Low stock — covers ~N families" when `quantity <= minimum_threshold`
- Stock warning banner in distribution form remains but is non-blocking: "Warning: stock may not cover all families. You can still proceed."
- No red error state tied to threshold

### Exit criteria
The admin can always save a distribution regardless of stock level. Low stock shows an amber warning only. The `families_coverable` estimate appears on resource cards.

---

## Phase 15 — Announcements: Create + Target Audience

**Root cause:** The admin Announcements panel renders existing announcements but has no create form.

### Backend
- Extend `AnnouncementController::store()` (or create it if missing) to accept:
  - `title`, `body`, `target` (`everyone` | `staff` | `families` | `barangay`)
  - `location_id` (required when `target = 'barangay'`)
- The API announcement list endpoint filters by `target` for the requesting user type

### Admin Web Panel
- "Create Announcement" button → modal with title, body (textarea), target selector, and optional barangay dropdown (shown only when target = barangay)
- Announcements list shows target badge next to each entry

### Staff Flutter App
- Announcement list already reads from API — ensure `target` filter is respected server-side so staff only see `everyone` and `staff` announcements

### Exit criteria
Admin can create an announcement targeted to everyone, staff only, families only, or a specific barangay. Staff app only shows announcements relevant to staff. Family app only shows announcements relevant to families.

---

## Phase 16 — Combined Transaction Log (Distribution History inside QR Tracking)

**Correction applied:** No new sidebar item is added. The existing "QR Tracking" page (`/qr-tracking`) is upgraded to be the combined transaction log. The "Distribution History" card inside the Distribution panel is removed from `distribution.tsx` and its data moves here. The sidebar and routes are unchanged.

**Design decision:** Calendar Grid layout inside the existing QR Tracking page — monthly view with day cells, each colored by distribution activity.

### What changes
- The "Distribution History" dropdown card is **removed** from `distribution.tsx`
- The QR Tracking page (`qr-tracking.tsx`) is split into two tabs:
  - **History** (new default) — calendar grid of distribution records
  - **Log a Scan** — the existing manual scan form (moved to a tab)
- `QrTrackingController::index()` receives `scheduleHistory` data alongside existing `scans`

### Admin Web Panel — `/qr-tracking` upgraded
- **Two tabs at the top:** `History` | `Log a Scan`
- **History tab — Calendar Grid:**
  - Month/Year picker (defaults to current month)
  - Calendar grid (7 columns × 5–6 rows)
  - Day cell with activity: colored dot (green = all completed, amber = some pending, red = has exclusions)
  - Day cell without activity: greyed out, dash in centre
  - Today highlighted with a border
  - Clicking a day expands records below the calendar:
    - Grouped by barangay; barangay tabs appear if multiple barangays on same day
    - Each record: Family name · Status badge · Resource · QR scan sub-entry (staff name, scan time)
    - "No distributions on this day" empty state when no records
  - Search bar filters by family name or barangay across the whole month
  - Export CSV button (Date, Barangay, Family, Status, Resource, Scanned By, Scan Time)
- **Log a Scan tab:** existing scan form and scan history list, unchanged

### Backend — `QrTrackingController`
- Pass `scheduleHistory` and `allLocations` as additional Inertia props in the `index()` response
- No new routes needed

### Distribution panel (`distribution.tsx`)
- Remove the "Distribution History" card (the `scheduleHistory` dropdown + table)
- Remove `scheduleHistory`, `selectedScheduleId`, `selectedHistoryPurok` state and related props
- Remove `scheduleHistory` from the Inertia props returned by `DistributionController::index()`

### Staff Flutter App
- The existing Distribution page history section (schedule dropdown + family list) is replaced with a Timeline List view (grouped by date, month picker at top, collapsible date rows)

### Exit criteria
Admin opens QR Tracking, sees the calendar, navigates months, clicks days to view distribution records, and exports. The Distribution panel no longer has a History section. QR scan records link to their distribution row.

---

## Updated Quick Reference

| Phase | Laravel | Staff Flutter | Family Flutter | Admin Web |
|---|---|---|---|---|
| 9  | `QrTrackingController` (scan→complete) | — | — | — |
| 10 | — | — | — | `start-admin.ps1`, `.env` handling |
| 11 | `DistributionController::index()` | — | — | Distribution panel (barangay scope, bulk assign, remove Scanned By) |
| 12 | `DistributionController`, `PurokController` | — | — | Team panel, Distribution form |
| 13 | `FamilyImportController` | — | — | Import flow (pre-import step) |
| 14 | Resource/Distribution endpoints | — | — | Resource cards, distribution form warnings |
| 15 | `AnnouncementController` | Announcement list | Announcement list | Announcements panel |
| 16 | `QrTrackingController`, `DistributionController` | `DistributionPage` history | — | QR Tracking page (calendar + scan log) |
| 17 | Family model, `FamilyController`, `QrTrackingController` | `ScanPage` | Household QR screen | — |

---

## Phase 17 — Family QR Code (Permanent, Reusable)

**Context:** Today the QR code on a `distributions` row (`DIST-XXXXXXXXXX`) is ephemeral — one code per distribution record. There is no permanent QR code tied to a family. Staff scan the distribution code, not a family identity card. The household app currently has no QR display.

**Goal:** Every registered family gets a single permanent QR code stored on the `families` table. This code is shown in the household app as a scannable image. Staff scan the family QR to look up and complete the family's distribution — replacing the need to scan a per-distribution code.

---

### Design Decisions

#### Same-day, same-location, multiple distributions (Rounds)
When a barangay has two separate schedules on the same calendar day (e.g. morning rice + afternoon medicine), they are labelled **Round 1** and **Round 2** by schedule creation order.

In the QR Tracking calendar:
- The day cell shows two colored dots side by side
- Clicking the day shows both rounds as separate collapsible sections
- A pill selector (Round 1 / Round 2 / All) filters which round is shown in the expanded view

#### Same-day, same-location, same-resource (Duplicate schedule)
Treated as a data integrity issue:
- Calendar day cell shows a ⚠ badge ("Duplicate")
- Both rows are highlighted amber in the expanded view
- Admin can delete one directly from the expanded view

#### Distribution not fully disseminated on day one (Carry-over)
The original schedule date is preserved — no automatic date changes. Families with `status = 'pending'` that belong to a past schedule are shown with a **"Carry-over"** badge in both the current date cell and the original date cell. The count of elapsed days is shown ("Day 3 of distribution"). No schema change required — derives from comparing `distribution_date` to today.

---

### Phase 17 Deliverables

#### Database
- New migration: `add_qr_code_to_families_table`
  - `qr_code` (string, unique, nullable) on `families`
  - Auto-generated on family creation via model observer: format `FAM-QR-XXXXXXXXXX` (10 random uppercase alphanumeric chars, collision-checked)
- Backfill script: generate `qr_code` for all existing families without one (run in migration `up()`)

#### Backend
- **`Family` model** — add `qr_code` to `$fillable`; add observer to auto-generate on `creating`
- **`FamilyController`** — include `qr_code` in the families prop returned to the admin panel
- **`Api\DistributionController::lookupByQr()`** — extend to also match `families.qr_code` (not just `distributions.qr_code`); when a family QR is scanned, return the family's active pending distribution
- **`QrTrackingController::store()`** — accept `family_qr_code` as an alternative to `qr_code`; resolve to the family's distribution before processing

#### Household App (Family Flutter)
- Add a "My QR Code" screen or card visible after login
- Display the QR as a scannable image using `qr_flutter` or equivalent package
- The QR value encodes the `families.qr_code` string
- Show the family ID and family name below the QR image for visual confirmation
- Screen is accessible from the home/dashboard of the household app

#### Admin Web Panel
- Show `qr_code` column in the Families table (copyable text)
- "View QR" button on each family row — opens a modal with the QR image (reuse the existing QrCodeCanvas pattern from `distribution.tsx`)

#### Staff Flutter App
- No change to scan flow needed — `lookupByQr` will accept either QR format
- The "Already Claimed" and "Family Excluded" modals already work correctly

#### Exit criteria
Every family has a `qr_code` value. The household app shows a scannable QR. Staff scan it; the server resolves the active distribution and marks it complete. The admin panel shows and can print/export the family QR.

---

*End of Implementation Phases*
