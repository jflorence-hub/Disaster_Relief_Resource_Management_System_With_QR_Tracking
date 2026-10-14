# Implementation Plan — Redesign QR Scan Form & History (Web + Flutter)

## Goal
Replace the resource-centric "Record QR Scan" form in both the Laravel/React web app and the
Flutter staff app with a family-relief-distribution scan. The new form captures: family (lookup),
family head, purok, relief/resource, quantity, scanned-by (auto), location, date, and time.
Remove: Resource/QR-code picker, From/Current Location, To/Destination Location, Brgy. Head /
Receiver, and Notes. Keep: camera scan (to look up the family by QR), scan status type.

---

## Findings from codebase exploration

### Current `qr_scans` table columns (all existing migrations applied)
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| resource_id | FK → resources | NOT NULL, cascadeOnDelete |
| destination_resource_id | FK → resources | nullable |
| location_id | FK → locations | nullable |
| from_location_id | FK → locations | nullable |
| to_location_id | FK → locations | nullable |
| scanned_by | FK → users | nullable |
| scan_type | enum(check_in, check_out, audit, transfer) | |
| recipient_name | string 255 | nullable |
| quantity_change | integer | |
| notes | text | nullable |
| scanned_at | datetime | |
| created_at / updated_at | timestamps | |

### QrScan model (`app/Models/QrScan.php`)
- `$fillable` lists all columns above.
- Relationships: `resource()`, `destinationResource()`, `location()`, `fromLocation()`,
  `toLocation()`, `scanner()` (→ User). **No family relationship yet.**

### Web QrTrackingController (`app/Http/Controllers/QrTrackingController.php`)
- `index()` — builds scans list and passes `resources`, `locations`, `purokHandlers` to Inertia.
- `store()` — validates `qr_code`, `location_id`, `to_location_id`, `scan_type`,
  `recipient_name`, `quantity_change`, `notes`; then calls private `createScan()`.
- `createScan()` — writes all columns including `from_location_id`/`to_location_id`.
- `destroy()` — admin-only delete.
- **No family_id, purok_id, or resource_id-from-family logic yet.**

### API QrTrackingController (`app/Http/Controllers/Api/QrTrackingController.php`)
- `lookup(POST /qr/lookup)` — finds resource by QR code, returns resource + last scan.
- `store(POST /qr/scan)` — validates `qr_code`, `location_id`, `scan_type`,
  `recipient_name`, `quantity_change`, `notes`; creates QrScan + adjusts resource quantity.
- `index(GET /qr/scans)` — returns last 50 scans with `resource`, `location`, `scanner`.
- **No family fields. `quantity_change` in the API is signed (positive or negative).**

### Family model (`app/Models/Family.php`)
- Columns in `$fillable`: `family_id`, `family_name`, `head_name`, `phone`, `email`,
  `household_member`, `address`, `purok_id`, `location_id`, `pin`, `api_token`, `status`.
- Relationships: `purok()` (→ Purok), `location()` (→ Location), `distributions()`, `household_member()`.
- **`purok_id` is a FK → puroks; `purok()->name` gives the purok name.**

### Purok model (`app/Models/Purok.php`)
- Columns: `name`, `code`, `assigned_staff_id`, `status`.
- Relationships: `assignedStaff()` (→ User), `families()`.

### Existing family lookup endpoint
- `GET /staff/families` (StaffFamilyController) — returns families filtered by staff's `purok_id`.
- No endpoint exists to look up **a single family by QR code**. One must be added.

### Flutter ScanPage (main.dart ~line 1510–1670)
- State class `_ScanPageState` — controllers: `code`, `quantity`, `notes`.
- State fields: `type` (string), `error`, `resource` (Map), `busy`, `cameraOpen`, `handled`.
- `lookup()` — POSTs to `/qr/lookup` with `{qr_code}`, stores result in `resource`.
- `save()` — POSTs to `/qr/scan` with `{qr_code, scan_type, quantity_change, location_id, notes}`.
- UI: camera scanner, QR code text field, Tracking-action dropdown (check_in/check_out/audit/transfer),
  quantity field, notes field.
- **The `resource` lookup drive the display — the family concept does not exist yet.**

### Flutter ScanHistoryPage (main.dart ~line 1680)
- Uses `_ApiListPage` with `path: '/qr/scans'`, `listKey: 'scans'`, `kind: 'scan'`.
- `_subtitle` for `kind == 'scan'` shows: `scan_type`, `quantity_change`, `scanned_at`, `location.name`.
- **No family, family head, or purok in the history display.**

### Flutter StaffDashboard (main.dart ~line 1210–1440)
- Already has a "My Assignment" card showing `Assigned Location` + `Assigned Purok`.
- Stat grid includes `Pending / In Transit` (not a standalone "Pending" card).
- **The dashboard already matches the requested card layout — no changes needed there.**

---

## Implementation Steps

---

- [ ] 1. **Add migration: `family_id` + `scan_status_type` to `qr_scans`**

  Create a new migration that:
  1. Adds `family_id` (nullable FK → families, nullOnDelete) after `resource_id`.
  2. Adds `scan_status_type` (nullable string 100) after `scan_type` — this is the new free-form
     field that replaces the enum `scan_type` semantics for display purposes. Keep the existing
     `scan_type` column because the backend logic (check_in/check_out/audit/transfer) depends on it;
     we will set it to a fixed value (`audit`) from the new form. `scan_status_type` carries the
     human-visible label the user picks (e.g. "Received", "Distributed", "Returned").
  3. Make `resource_id` nullable (it is currently NOT NULL; we need to relax it because the new form
     is family-driven, not resource-driven). Add `nullable()` modifier via `Schema::table` +
     `$table->foreignId('resource_id')->nullable()->change()`.

  **Gotcha:** `resource_id` has a FK constraint. Use `change()` on the column (requires
  `doctrine/dbal` if not already present) OR drop+re-add the FK. Check whether `doctrine/dbal`
  is in `composer.json`; if not, the migration must drop the FK first, alter the column, then
  re-add the FK as nullable.

  File to create:
  `database/migrations/2026_10_14_000001_add_family_and_scan_status_type_to_qr_scans_table.php`

  Verify: `php artisan migrate` runs without error; `php artisan db:show --table=qr_scans`
  shows the new columns.

---

- [ ] 2. **Update QrScan model**

  File: `app/Models/QrScan.php`

  Changes:
  - Add `'family_id'` and `'scan_status_type'` to `$fillable`.
  - Add the `family()` BelongsTo relationship:
    ```php
    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }
    ```
  - Add `use App\Models\Family;` import.
  - No cast changes needed (`family_id` is an integer FK, `scan_status_type` is a string).

  Verify: `php artisan tinker` → `App\Models\QrScan::first()?->family` returns without error
  (null is fine; confirms the relationship is wired).

---

- [ ] 3. **Add API endpoint: look up a family by QR code / family_id**

  The Flutter camera will scan a family's distribution QR code. That QR code is stored in
  the `distributions.qr_code` column (format `DIST-XXXXXXXXXX`). The scan should find the
  family via their distribution record.

  Add a new route and controller method:

  **Route** (`routes/api.php`, inside the `auth.token + auth.staff` group):
  ```
  Route::post('family/lookup', [StaffFamilyController::class, 'lookup']);
  ```

  **Method** in `app/Http/Controllers/Api/StaffFamilyController.php`:
  - Accepts `qr_code` (required string).
  - Looks up `distributions` where `qr_code = $request->qr_code`, eager-loads `family.purok`.
  - Returns the family record plus its purok name, or `404 found: false`.
  - Response shape:
    ```json
    {
      "found": true,
      "family": {
        "id": 1,
        "family_id": "FAM-001",
        "family_name": "Santos Family",
        "head_name": "Juan Santos",
        "purok_id": 2,
        "purok": { "id": 2, "name": "Purok 3" }
      },
      "distribution": {
        "id": 10,
        "resource": { "id": 5, "name": "Rice", "unit": "kg" },
        "quantity": 5,
        "status": "pending"
      }
    }
    ```

  Verify: `php artisan route:list --path=family/lookup` shows the new route.

---

- [ ] 4. **Update API QrTrackingController — `store()` and `index()`**

  File: `app/Http/Controllers/Api/QrTrackingController.php`

  **`store()` changes:**
  - Replace the validation block. New required/allowed fields:
    - `family_id` — nullable integer, exists:families,id
    - `scan_status_type` — nullable string max:100 (the human label, e.g. "Received")
    - `location_id` — nullable, exists:locations,id (kept — the release location)
    - `quantity_change` — required, integer, min:1
    - Remove: `qr_code` (no longer the primary key for the scan), `scan_type` (force to `'audit'`
      internally), `recipient_name`, `notes`.
    - **Keep `qr_code` as optional nullable** so old clients don't break, but do NOT use it to
      drive resource quantity changes.
  - In the transaction body:
    - Set `scan_type = 'audit'` unconditionally (no inventory movement; this form records
      distribution events, not warehouse transfers).
    - Set `resource_id = null` (or look up via the distribution if `family_id` is given and
      a pending distribution exists — see Step 3's distribution return).
    - Write the new fields: `family_id`, `scan_status_type`, `location_id`, `scanned_by`,
      `scanned_at = now()`, `quantity_change`.
    - **Remove** the inventory `resource->quantity` adjustment block.
  - Load the scan for the response with `family.purok` eager-loaded.

  **`index()` changes:**
  - Add `'family:id,family_id,family_name,head_name,purok_id'` and `'family.purok:id,name'`
    to the `with()` call.
  - Include `family` and `scan_status_type` in the returned JSON objects.

  Verify: `php artisan route:list --path=qr` shows unchanged routes; a manual POST to
  `/api/qr/scan` with `{family_id, scan_status_type, location_id, quantity_change}` returns
  HTTP 201 with the new fields.

---

- [ ] 5. **Update web QrTrackingController — `index()` and `store()`**

  File: `app/Http/Controllers/QrTrackingController.php`

  **`index()` changes:**
  - Replace `with(['resource:...', 'location:...', ...])` with:
    ```php
    ->with([
        'family:id,family_id,family_name,head_name,purok_id',
        'family.purok:id,name',
        'location:id,name',
        'scanner:id,name',
    ])
    ```
    (Drop: `resource`, `fromLocation`, `toLocation`, `destinationResource`.)
  - In the `map()` closure, replace the existing field list with:
    `id`, `family_id` (FK), `scan_status_type`, `location_id`, `scanned_by`, `quantity_change`,
    `scanned_at`, plus eager-loaded `family` (with nested `purok`), `location`, `scanner`.
    Remove: `resource`, `from_location`, `to_location`, `destination_resource`,
    `recipient_name`, `notes`, `scan_type` (keep it for badge display if useful).
  - Replace the `resources` and `purokHandlers` props with a `families` prop:
    ```php
    'families' => Family::select('id','family_id','family_name','head_name','purok_id')
        ->with('purok:id,name')
        ->where('status', 'active')
        ->when(!$isAdmin, fn($q) => $q->where('purok_id', ...))   // staff see their purok only
        ->orderBy('family_name')
        ->get(),
    ```
    Keep `locations` (staff needs the release location dropdown).
    Add `use App\Models\Family;` import.
  - Staff purok filtering: staff's `purok_id` comes from `$user->purok_id`.

  **`store()` changes:**
  - Replace the validation block with:
    ```php
    $data = $request->validate([
        'family_id'        => 'required|integer|exists:families,id',
        'scan_status_type' => 'nullable|string|max:100',
        'location_id'      => 'nullable|exists:locations,id',
        'quantity_change'  => 'required|integer|min:1',
    ]);
    ```
  - Remove the entire `DB::transaction` with inventory logic. Replace with a simple
    `QrScan::create([...])` using the new fields, `scan_type = 'audit'`, `resource_id = null`,
    `scanned_by = $request->user()->id`, `scanned_at = now()`.
  - Remove `createScan()` private method (no longer needed), or keep it but add a new
    family-specific variant.
  - Keep `destroy()` unchanged.

  Verify: `php artisan route:list --path=qr-tracking` shows unchanged routes. Submitting
  the updated React form returns a redirect with `success` flash.

---

- [ ] 6. **Update TypeScript types (`models.ts`)**

  File: `resources/js/types/models.ts`

  Changes to the `QrScan` interface:
  - Remove: `resource_id`, `destination_resource_id`, `from_location_id`, `to_location_id`,
    `recipient_name`, `notes`, `resource`, `destination_resource`, `from_location`, `to_location`.
  - Add:
    ```ts
    family_id: number | null;
    scan_status_type: string | null;
    family?: {
        id: number;
        family_id: string;
        family_name: string;
        head_name: string;
        purok_id: number;
        purok?: { id: number; name: string } | null;
    } | null;
    ```
  - Keep: `id`, `location_id`, `scanned_by`, `scan_type`, `quantity_change`, `scanned_at`,
    `location`, `scanner`.

  Also add a `Family` interface (reuse the inline shape already in `Distribution`) as a
  top-level export for use in the updated page.

  Verify: `npm run build` (or `npx tsc --noEmit`) completes without type errors.

---

- [ ] 7. **Rewrite React `qr-tracking.tsx` — form and table**

  File: `resources/js/pages/qr-tracking.tsx`

  **Props change:** replace `resources` (ResourceItem[]) and `purokHandlers` with `families`
  (Family[]). Keep `scans`, `locations`, `userRole`.

  **FormData interface — new shape:**
  ```ts
  interface FormData {
      family_id: string;        // selected family's numeric id as string
      scan_status_type: string; // chosen status label
      location_id: string;
      quantity_change: number | string;
  }
  ```

  **Form fields in the modal (keep camera, remove everything else):**
  1. **Camera scanner** — keep exactly as is. On decode: look up `families` array by
     `family_id` string or fall back to searching `family.family_id`.
  2. ~~Resource/QR code~~ — **removed**.
  3. **Family** dropdown — `select` over `families` prop, showing `family_name — family_id`.
     On change: populate head_name, purok display fields automatically.
  4. **Family Head** — read-only text input, auto-filled from selected family's `head_name`.
  5. **Purok** — read-only text input, auto-filled from `family.purok.name`.
  6. **Scan Status Type** — `select` with options:
     `["Received", "Distributed", "Returned", "Claimed", "Verified"]`.
  7. **Relief** (display only) — auto-filled from the family's `latest_distribution.resource.name`
     if available; otherwise show "—". This is informational (not stored in the scan form
     itself — the scan is linked to the family, not the resource).
  8. **Quantity** — number input (min 1). Keep existing validation.
  9. ~~Notes~~ — **removed**.
  10. ~~From/Current Location~~ — **removed**.
  11. ~~To/Destination Location~~ — **removed**.
  12. ~~Brgy. Head / Receiver~~ — **removed**.
  13. **Location** (release location) — `select` from `locations`.
  14. **Date** — read-only, shows today's date (auto — `new Date().toLocaleDateString()`).
  15. **Time** — read-only, shows current time (auto — `new Date().toLocaleTimeString()`).
  16. **Scanned By** — read-only, auto from `scanner.name` (not in form state; displayed
      as informational note "Will be recorded as your account name").

  **History table — new columns:**
  Remove: Resource, Type (scan_type), From, To, Receiver.
  Add: Family (family_name), Family Head (head_name), Purok (purok.name),
  Scan Status (scan_status_type), Relief (show "—" since resource is not stored),
  Quantity, Location (location.name), Scanned By, Time.

  **Badge map** — replace `scanTypeBadge` with `scanStatusBadge` using the new status types.

  Verify: `npm run build` succeeds. Visiting `/qr-tracking` in the browser shows the new
  form and table without console errors.

---

- [ ] 8. **Rewrite Flutter `ScanPage` in `main.dart`**

  File: `staff_relief_distribution_application/lib/main.dart`

  Locate class `_ScanPageState` (starts ~line 1510).

  **Remove controllers / state:**
  - Remove: `notes` TextEditingController, `resource` (Map), `type` (String).
  - Add: `family` (Map?), `distribution` (Map?), `scanStatusType` (String with default
    `'Received'`), `locationId` (int?), `locations` (List<Map> for dropdown).

  **New `lookup()` method:**
  - POST to `/family/lookup` with `{qr_code: value}`.
  - On success: set `family = response['family']`, `distribution = response['distribution']`.
  - On 404: set `error = 'No family found for this QR code.'`.

  **New `_loadLocations()` method:**
  - Called in `initState()`.
  - GET `/locations` → parse `locations` list → store in state.

  **`save()` method — new body:**
  ```dart
  await Api.req('POST', '/qr/scan', body: {
      'family_id': family!['id'],
      'scan_status_type': scanStatusType,
      'location_id': locationId,
      'quantity_change': int.parse(quantity.text),
  });
  ```
  After success: clear `family`, `distribution`, reset `code`, `quantity`.

  **UI — keep camera, rebuild form fields:**
  1. Camera scanner block — keep exactly as is (same MobileScanner widget, same toggle button).
  2. QR code text field — keep (used to manually enter the family QR / distribution QR code).
  3. "Find family" button (rename from "Find resource").
  4. If `family != null`: show a blue info card:
     - Family: `family_name`
     - Family Head: `head_name`
     - Purok: `family['purok']['name']`
     - Relief: `distribution['resource']['name'] ?? '—'`
       Quantity to receive: `distribution['quantity'] ?? '—'`
  5. **Scan Status Type** — `DropdownButtonFormField` with values:
     `['Received', 'Distributed', 'Returned', 'Claimed', 'Verified']`.
  6. **Quantity** — existing TextField controller, keep as-is.
  7. **Location** — `DropdownButtonFormField` built from `locations` state list.
  8. **Date / Time** — two read-only TextFields showing `DateTime.now()` formatted strings,
     updated via `setState` or just computed inline in `build`.
  9. **Scanned By** — small grey note text "Recorded under your account".
  10. Remove: Tracking-action dropdown, Notes field.

  Verify: `flutter analyze` passes. App runs; scanning a distribution QR code populates the
  family card; submitting sends the new payload to `/api/qr/scan`.

---

- [ ] 9. **Update Flutter `ScanHistoryPage` / `_ApiListPage` scan subtitle**

  File: `staff_relief_distribution_application/lib/main.dart`

  Locate the `_subtitle` method in `_ApiListPageState` (~line 1745).

  Change the `'scan'` case from:
  ```dart
  'scan' => [
      row['scan_type'],
      row['quantity_change'] == null ? null : 'Qty ${row['quantity_change']}',
      row['scanned_at'] ?? row['created_at'],
      row['location']?['name'],
  ],
  ```
  To:
  ```dart
  'scan' => [
      row['family']?['family_name'],
      row['family']?['head_name'],
      row['family']?['purok']?['name'],
      row['scan_status_type'] ?? row['scan_type'],
      row['quantity_change'] == null ? null : 'Qty ${row['quantity_change']}',
      row['location']?['name'],
      row['scanner']?['name'] == null ? null : 'By ${row['scanner']['name']}',
      row['scanned_at'] ?? row['created_at'],
  ],
  ```

  Also update `_title` method — for `kind == 'scan'`, the current fallback chain already
  includes `row['scan_type']` via the last fallback. Prepend:
  ```dart
  row['family']?['family_name'] ??
  ```
  before `row['scan_type']`.

  Verify: `flutter analyze` passes. The Scan History screen shows family name, head name,
  purok, and scan status type in each card subtitle.

---

## Key gotchas and decisions

1. **`resource_id` must become nullable** — the new form does not require a resource; the scan
   is family-driven. The existing `NOT NULL` constraint will cause a DB error if not relaxed first.
   This is the most important prerequisite. Handle in Step 1.

2. **`scan_type` stays in the DB** — it's used by the web controller's inventory logic. Force
   it to `'audit'` (no-op for inventory) in both controllers when the new form is submitted.
   The human-visible label goes in `scan_status_type`.

3. **Family lookup uses `distributions.qr_code`** — the distribution QR (`DIST-XXXXXXXXXX`)
   is what gets printed/attached to relief packages. The camera in the Flutter app and the web
   should scan that code to look up which family it belongs to. The new `/family/lookup` endpoint
   searches `distributions.qr_code`.

4. **`StaffFamilyController::lookup`** — staff see only families in their own purok (`purok_id`
   filtered). This filter should also apply to the lookup endpoint so staff can't scan another
   purok's family by QR code. Admin bypasses the filter.

5. **Web React camera scanner** — the existing `CameraScanner` component and `handleDecoded`
   callback currently look up resources by QR. In Step 7, `handleDecoded` should instead look
   up families by scanning the distribution QR code. The camera component itself doesn't change.

6. **`doctrine/dbal` for column change** — if not in `composer.json`, the `nullable()->change()`
   call in the migration will fail. Alternative: drop the FK, drop `NOT NULL` via raw SQL
   (`ALTER TABLE qr_scans MODIFY resource_id BIGINT UNSIGNED NULL`), then re-add FK. The
   implementer should check `composer.json` first.

7. **Old scan records** — existing rows have `resource_id` set and `family_id = null`. The
   history table on the web and the Flutter history list must handle both: show resource name
   if `family` is null (backwards compat row), else show family name.

8. **No new npm or Flutter packages needed** — all features use existing patterns and
   components.
