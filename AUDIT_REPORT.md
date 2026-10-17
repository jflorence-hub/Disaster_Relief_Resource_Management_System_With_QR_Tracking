# System Audit Report - Updated
**Date:** October 17, 2026
**Auditor:** Kiro AI
**Previous audit:** 2025 (original)

**Systems Audited:**
1. `Disaster_Relief_Resource_Management_System_With_QR_Trackings` - Laravel 11 backend + Admin Web Panel (Inertia/React)
2. `staff_relief_distribution_application` - Flutter (Staff mobile app)
3. `barangay_household_information_application` - Flutter (Family/Household mobile app)

**Scope:** This report reflects the state of all three systems after the completion of Phases 1-17 as documented in `IMPLEMENTATION_PHASES.md`. Issues marked **RESOLVED** were identified in the 2025 audit and have since been addressed. Issues marked **OPEN** remain and require attention.

---

## Summary of Changes Since Last Audit

| Phase | What Was Done |
|---|---|
| 1 | Database schema finalized - resource sets, distribution items, excluded fields, staff profile fields |
| 2 | QR scan flow corrected - scan now atomically completes the distribution record |
| 3 | Staff ID auto-generation (`STAFF-XXXXXX`) implemented |
| 4 | Staff registration: location/purok filtering, password strength bar |
| 5 | Admin manual staff creation with welcome email |
| 6 | Bulk family import from Excel/CSV with barangay auto-creation |
| 7 | Resource sets (bundled goods) implemented with set/individual distribution assignment |
| 8 | Distribution filter tabs (All/Pending/Completed/Excluded) and family exclusion controls |
| 9 | `QrTrackingController::handleCompletionScan()` - QR-code-first lookup, dual duplicate detection, consistent 409 response |
| 10 | `start-admin.ps1` auto-sets `APP_URL=localhost:8000`; `start-ngrok-dev.ps1` auto-detects ngrok URL; UTF-8 mojibake fixed in PHP comments |
| 11 | Distribution panel scoped to selected barangay; `allLocations` prop added; "Scanned By" column removed |
| 12 | Cross-barangay staff assignment blocked at server and client; distribution auto-creation scoped to filter |
| 13 | Family import upserts captain info on existing barangays; new barangay validates all 4 header fields; puroks auto-created per location |
| 14 | `minimum_threshold` is now a soft amber warning only - never a save gate; `families_coverable` estimate on resource cards |
| 15 | Announcements create form added; 4 audience targets (everyone/staff/family/barangay); `location_id` on announcements |
| 16 | QR Tracking page upgraded: calendar grid history, "Log a Scan" tab; distribution history removed from Distribution panel |
| 17 | Permanent family QR code (`FAM-QR-XXXXXXXXXX`) on `families` table; household app "My QR" screen; `lookupByQr` accepts both QR formats |

---

## SYSTEM 1 - Laravel Backend + Admin Web Panel

### OPEN Issues

#### 1. Password reset does not validate OTP before allowing reset
**File:** `app/Http/Controllers/Api/AuthController.php` - `resetPassword()`
**Severity:** High
**Status:** OPEN - unchanged from original audit
The `POST /password/reset` endpoint accepts `email + new_password` without validating that the OTP step was completed. A caller who knows a user's email can reset the password directly without going through OTP verification. The OTP verify endpoint (`/password/verify-otp`) returns a success message but does not issue any token or session that the reset step checks.
**Fix needed:** After OTP verification, issue a short-lived signed token (or store `password_reset_verified_at` with a 5-minute TTL). The reset endpoint must validate that token before allowing the change.

---

#### 2. `applyStock()` has no guard against negative stock or double-application
**File:** `app/Models/Distribution.php` - `applyStock()`
**Severity:** Medium
**Status:** OPEN - unchanged from original audit
`applyStock()` calls `decrement()` unconditionally with no check that sufficient stock exists and no idempotency guard. If called twice (retry, race condition) stock goes negative silently.
**Fix needed:** Wrap in a transaction with `WHERE quantity >= amount` optimistic lock and throw an exception on failure.

---

#### 3. No rate limiting on authentication and OTP endpoints
**File:** `routes/api.php`
**Severity:** High
**Status:** OPEN - unchanged from original audit
`POST /login`, `POST /family/login`, `POST /password/forgot`, `POST /family/forgot-password` have no rate limiting, enabling brute-force attacks on 6-digit PINs (1,000,000 combinations) and OTPs.
**Fix needed:** Apply `throttle:5,1` middleware to all auth and OTP routes.

---

#### 4. Hardcoded API token authentication - Sanctum not used
**File:** `app/Models/User.php`, `app/Models/Family.php`, auth middleware files
**Severity:** Medium
**Status:** OPEN - unchanged from original audit
The system uses a custom `api_token` column with raw SHA-256 hashing instead of Laravel Sanctum (which is already installed). This bypasses token revocation, expiry, and multi-device session management.
**Fix needed:** Migrate to Sanctum's `HasApiTokens` trait and `sanctum` middleware.

---

#### 5. Double `.php.php` extension migration file
**File:** `database/migrations/2026_09_26_..._families_table.php.php`
**Severity:** Low
**Status:** OPEN - unchanged from original audit
One migration file has a double `.php.php` extension. Laravel's migration discovery will silently skip it on a fresh install if the filename filter doesn't match `*.php` exactly.
**Fix needed:** Rename the file to the correct single `.php` extension.

---

#### 6. No pagination on list endpoints
**File:** `routes/api.php`, various API controllers
**Severity:** Medium
**Status:** OPEN
`/staff/families`, `/resources`, and `/distributions/history` return all records with no pagination. The QR tracking controller caps at 200 records. As families and distributions grow, these will degrade. The admin web panel's `scheduleHistory` query in `QrTrackingController::index()` loads all schedules with all their family distributions - this will become very slow.
**Fix needed:** Add cursor-based or offset pagination to all list endpoints. For `scheduleHistory`, scope to the current month by default and paginate months.

---

#### 7. `Mail::raw()` used for all emails - no templates
**File:** `AuthController.php`, `TeamController.php`, `FamilyAuthController.php`
**Severity:** Low
**Status:** OPEN - unchanged from original audit
All system emails (OTP codes, staff approval, welcome emails) are sent as plain-text strings. No HTML formatting, no branding.
**Fix needed:** Replace with Laravel Mailables and Blade templates.

---

#### 8. Locations endpoint is public and returns all location data
**File:** `routes/api.php` - `Route::get('locations', ...)`
**Severity:** Low
**Status:** OPEN - unchanged from original audit
The `/locations` endpoint requires no authentication and returns full location records including captain contact details.
**Fix needed:** Restrict to `id` and `name` for the public endpoint, or require authentication.

---

#### 9. `APP_URL` in `.env` still points to an ngrok URL after ngrok sessions
**File:** `.env`
**Severity:** Medium
**Status:** PARTIALLY RESOLVED - Phase 10 automated the fix
`start-admin.ps1` now rewrites `APP_URL=http://localhost:8000` automatically on launch. However, if the server is started manually (not via the script), `APP_URL` may still be wrong. The `.env` currently has duplicate `NGROK_URL` entries (the key appears three times).
**Fix needed:** Clean up the duplicate `NGROK_URL` entries in `.env`. Consider adding a note to never start the servers without the script.

---

#### 10. Announcements `audience` field uses a different name than Phase 15 documentation
**File:** `app/Models/Announcement.php`, `app/Http/Controllers/AnnouncementController.php`
**Severity:** Low
**Status:** New - introduced in Phase 15
The model uses `audience` (family/staff/everyone/barangay) but the Phase 15 plan called the field `target`. The API `staffIndex()` and `familyIndex()` endpoints do not yet expose announcements to the API by audience in a combined "everyone + staff" / "everyone + family" query - only exact audience match. The `staffIndex` now correctly returns `whereIn('audience', ['staff', 'everyone'])`, which is correct.
**Status:** Resolved for functionality. The naming inconsistency (`audience` vs `target`) is cosmetic and low priority.

---

### RESOLVED Issues (from 2025 audit)

| # | Issue | Resolved In |
|---|---|---|
| Original #8 | QR scan does not update Distribution status | Phase 9 |
| Original #1 (partial) | Admin role-gated features not showing | Phase 10 (APP_URL fix) |
| Original note | `qr_code` not in `$fillable` on Distribution model | Phase 1 (verified in model) |
| - | Distribution History disconnected from QR Tracking | Phase 16 |
| - | Cross-barangay staff assignment | Phase 12 |
| - | Barangay filter not working | Phase 11 |
| - | Family import silently ignores existing barangay data | Phase 13 |
| - | Threshold blocking saves | Phase 14 |
| - | No announcement create form | Phase 15 |
| - | No permanent family QR code | Phase 17 |

---

## SYSTEM 2 - Staff Flutter App

### OPEN Issues

#### 1. Demo credentials visible in production login screen
**File:** `lib/main.dart` - `LoginPage` build method
**Severity:** High
**Status:** OPEN - unchanged from original audit
The text `'Demo admin login: admin@disasterrelief.test / password'` is rendered in the production login screen with no `kDebugMode` guard.
**Fix needed:** Wrap in `if (kDebugMode) ...` or remove entirely.

---

#### 2. "Remember me" checkbox is cosmetic - email is never persisted
**File:** `lib/main.dart` - `_LoginPageState`
**Severity:** Low
**Status:** OPEN - unchanged from original audit
The checkbox exists and tracks state but the email is never saved to `SharedPreferences` when checked.
**Fix needed:** Implement or remove.

---

#### 3. No token expiry handling - 401 doesn't redirect to login
**File:** `lib/api.dart`
**Severity:** Medium
**Status:** OPEN - unchanged from original audit
When the server returns 401 (token revoked or expired), each page handles it locally with a generic error message. There is no global interceptor to automatically redirect to the login screen.
**Fix needed:** Add a global API error handler that catches 401 responses and calls `Api.clearToken()` then navigates to `LoginPage`.

---

#### 4. `IndexedStack` builds and initialises all pages on launch
**File:** `lib/main.dart` - `_StaffHomeState`
**Severity:** Medium
**Status:** OPEN - unchanged from original audit
All pages are constructed and their `initState` methods run on app launch, firing multiple simultaneous API calls. The dashboard, resources, QR history, families, and distribution pages all load data at once.
**Fix needed:** Use lazy loading or `AutomaticKeepAliveClientMixin` with deferred loading.

---

#### 5. `Api.req()` only supports GET and POST - PATCH is a separate method
**File:** `lib/api.dart`
**Severity:** Low
**Status:** OPEN - unchanged from original audit
`Api.req()` throws `ArgumentError` for any method other than GET or POST. PATCH is implemented as a separate `Api.patch()` method. PUT and DELETE are not supported at all, limiting future extensibility.
**Fix needed:** Extend `Api.req()` to accept all HTTP methods.

---

### RESOLVED Issues

| # | Issue | Resolved In |
|---|---|---|
| Original #4 | Distribution status stays pending after scan | Phase 9 |
| - | "Already Claimed" modal (409) | Phase 9 (already existed, now works) |
| - | "Family Excluded" modal (403) | Phase 9 (already existed, now works) |
| - | Distribution filter tabs (All/Pending/Completed/Excluded) | Phase 8 |
| - | Status filter defaults to Pending | Phase 8 |
| - | Carry-over and Excluded badge in distribution list | Phase 8 |

---

## SYSTEM 3 - Family Flutter App

### OPEN Issues

#### 1. `_checkAnnouncements()` shows a blocking modal for every new announcement
**File:** `lib/main.dart` - `_FamilyHomeState._checkAnnouncements()`
**Severity:** Medium
**Status:** OPEN - unchanged from original audit
Multiple new announcements produce a chain of blocking `AlertDialog` modals. If the app is backgrounded mid-chain, `mounted` checks can fail.
**Fix needed:** Show only the most recent as a dialog, or list all new announcements in a single dialog.

---

#### 2. `AuthScaffold` widget defined but never used
**File:** `lib/main.dart`
**Severity:** Low
**Status:** OPEN - unchanged from original audit
Dead code - the `AuthScaffold` class is defined but never referenced.
**Fix needed:** Remove it.

---

#### 3. PIN is minimum 4 digits - brute-force risk
**File:** Backend `FamilyAuthController`, Flutter `RegisterPage`
**Severity:** Medium
**Status:** OPEN
The system allows 4-digit PINs (only 10,000 combinations). Combined with no rate limiting on `/family/login`, this is a brute-force risk for family accounts.
**Fix needed:** Enforce 6-digit minimum on both client and server. Add rate limiting to `/family/login`.

---

#### 4. QR code screen loaded via API each time - no caching
**File:** `lib/main.dart` - `_FamilyQrPageState`
**Severity:** Low
**Status:** New - introduced in Phase 17
The "My QR" screen calls `GET /family/me` every time it loads to retrieve `qr_code`. Since this value never changes after creation, it should be cached locally.
**Fix needed:** Cache `qr_code` in `SharedPreferences` on first load; only re-fetch on cache miss.

---

### RESOLVED Issues

| # | Issue | Resolved In |
|---|---|---|
| - | No QR code in the household app | Phase 17 |
| - | Excluded distribution status not shown | Phase 8 |
| - | No announcement display | Pre-existing; API already existed |
| Original #4 | Duplicate `@override` annotation | Cosmetic - acceptable |

---

## CROSS-SYSTEM ISSUES

### OPEN

#### 1. API token stored in `SharedPreferences` (unencrypted)
**Files:** Both `lib/api.dart` files
**Severity:** High
**Status:** OPEN - unchanged from original audit
Bearer tokens are stored in plain XML on Android (rooted device risk). iOS is somewhat safer but still not Keychain-protected.
**Fix needed:** Replace `SharedPreferences` with `flutter_secure_storage` for token storage.

---

#### 2. ngrok URL as default API base - no stable fallback
**Files:** Both `lib/api.dart` files
**Severity:** High
**Status:** OPEN
Default `API_BASE_URL` remains `https://ambitious-flaring-jelly.ngrok-free.dev/api`. If this ngrok tunnel expires (which it does on every ngrok restart on the free plan), both apps stop working entirely. Apps built without `--dart-define` will fail immediately.
**Fix needed:** Change the default to a stable IP or domain. Only use ngrok for development builds. Add a startup connectivity check that shows a clear "Cannot reach server" message with the current URL shown for debugging.

---

#### 3. No HTTPS certificate pinning
**Files:** Both `lib/api.dart` files
**Severity:** Medium
**Status:** OPEN - unchanged from original audit
No certificate pinning. MITM attacks possible on untrusted Wi-Fi networks.
**Fix needed:** Implement certificate pinning or at minimum document the risk.

---

#### 4. No offline handling or connectivity checks
**Files:** Both Flutter apps
**Severity:** Medium
**Status:** OPEN - unchanged from original audit
API failures show generic error strings. No cached data is shown offline. No `connectivity_plus` or equivalent check before requests.
**Fix needed:** Add connectivity checks; cache last successful read-only responses.

---

#### 5. No API versioning
**File:** `routes/api.php`
**Severity:** Low
**Status:** OPEN - unchanged from original audit
All routes are under `/api/` with no version prefix. Adding `/api/v1/` later would be a breaking change for all mobile app builds.
**Fix needed:** Prefix routes with `/api/v1/` and update both app `API_BASE_URL` defaults accordingly.

---

#### 6. Race condition in family_id generation
**File:** `app/Http/Controllers/Api/FamilyAuthController.php` - `register()`
**Severity:** Medium
**Status:** OPEN - unchanged from original audit
`family_id` generation uses a check-then-insert pattern without a unique constraint safety net for the human-readable ID segment. Under concurrent registrations, two families could get the same `family_id` before either transaction commits if the unique index is not enforced at DB level.
**Fix needed:** Verify a unique index exists on `families.family_id`. Wrap the generation + insert in `DB::transaction()`.

---

### RESOLVED Cross-System Issues

| # | Issue | Resolved In |
|---|---|---|
| Original #5 | QR scan and distribution confirmation disconnected | Phase 9 |
| - | Barangay filter broken across panels | Phase 11, 12 |
| - | Admin APP_URL mismatch causing role features to hide | Phase 10 |

---

## New Issues Introduced in Phases 9-17

| # | System | Issue | Severity |
|---|---|---|---|
| N1 | Admin Web | `scheduleHistory` query in `QrTrackingController` loads all schedules with no month filter - will degrade as data grows | Medium |
| N2 | Admin Web | `QrTrackingController::store()` still uses `scan_type: released/returned/verified` validation - the staff app sends `completed` but the web form doesn't support it | Low |
| N3 | Admin Web | Distribution bulk-assign ("Assign Resource to All") documented in Phase 11 but not yet implemented in code | Medium |
| N4 | Laravel | `BackfillFamilyQrCodes` artisan command left in `app/Console/Commands/` - it is a one-time migration tool that should be removed or moved to a seeder | Low |
| N5 | Family App | `FamilyQrPage` calls `/family/me` - this endpoint must return `qr_code` in its response. Verify `qr_code` is not in `$hidden` on the `Family` model | Medium |
| N6 | Both Apps | Family QR code format `FAM-QR-XXXXXXXXXX` and distribution QR format `DIST-XXXXXXXXXX` are not visually distinguishable when printed. Staff could scan a distribution QR by mistake. | Low |
| N7 | Laravel | `.env` has three `NGROK_URL` entries (one duplicate key) - the last value wins but the file is confusing | Low |

---

## Recommended Priority Order for Remaining Work

| Priority | Action |
|---|---|
| [CRITICAL] Critical | Add rate limiting to all auth and OTP endpoints (`throttle:5,1`) |
| [CRITICAL] Critical | Fix OTP → password reset validation gap |
| [CRITICAL] Critical | Replace `SharedPreferences` token storage with `flutter_secure_storage` |
| [HIGH] High | Remove demo credentials from production login screen |
| [HIGH] High | Change default `API_BASE_URL` from ngrok to a stable address |
| [HIGH] High | Add global 401 interceptor → redirect to login |
| [HIGH] High | Verify `qr_code` is returned by `/family/me` (not in `$hidden`) |
| [HIGH] High | Implement bulk-assign resource to all families (Phase 11 - documented but not coded) |
| [MEDIUM] Medium | Paginate `scheduleHistory` by month in `QrTrackingController` |
| [MEDIUM] Medium | Guard `applyStock()` against double-application and negative stock |
| [MEDIUM] Medium | Cache family QR code in `SharedPreferences` in the household app |
| [MEDIUM] Medium | Fix race condition in `family_id` generation (add unique DB index) |
| [LOW] Low | Remove `BackfillFamilyQrCodes` command or move to seeder |
| [LOW] Low | Clean up duplicate `NGROK_URL` entries in `.env` |
| [LOW] Low | Rename double-extension migration file |
| [LOW] Low | Replace `Mail::raw()` with proper Mailables |
| [LOW] Low | Remove unused `AuthScaffold` widget |
| [LOW] Low | Add API version prefix `/api/v1/` |

---

*End of Audit Report - October 17, 2026*