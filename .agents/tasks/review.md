# QR Scan Redesign — Family-centric relief tracking

The scan form was redesigned from a resource/inventory-movement model to a family distribution tracking model. Instead of scanning a resource QR code to log inventory changes, staff now select a family, confirm auto-filled head and purok fields, choose a scan status, pick a location and timestamp, and optionally use the camera to match a family by their QR code. A migration adds `family_id`, `scan_date`, and `scan_time` to the `qr_scans` table to persist the new data. Both the web and mobile surfaces were updated in parallel.

Watch for: **(confirmed)** the Relief/Resource column in the web table and the Relief field in the Flutter form are always `—`/empty — there is no mechanism to resolve which relief a family will receive from a scan record alone; **(confirmed)** Flutter read-only TextFields for Family Head and Purok use inline `TextEditingController(text: ...)` constructors that leak a new controller on every rebuild; **(possible)** the `scan_type` enum values (`check_in`, `check_out`, `audit`, `transfer`) are inventory-oriented labels that no longer match the family-relief context, which may confuse staff reading scan history.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The migration adds `family_id` as a nullable foreign key with `nullOnDelete`, plus `scan_date` and `scan_time`. Legacy fields (`resource_id`, `notes`, `recipient_name`, etc.) remain in `$fillable` for backward compatibility with existing records.

Both controllers drop the old inventory mutation logic. The web controller resolves `family.purok.name` to a flat string before passing data to Inertia; the API controller does the same in both `store()` and `index()`. `scanned_by` is always set from the authenticated user — staff cannot forge the scanner identity.

The React page and Flutter `ScanPage` both have the camera scanner intact, the family dropdown with auto-filled head and purok, scan status selector, location dropdown, and date/time inputs. The Relief/Resource column and field are present in both surfaces but always render empty: `store()` never writes `resource_id` to the record, so the history column will always show `—`.

The Flutter `ScanPage` read-only fields for Family Head and Purok construct a new `TextEditingController` inline on every `build()` call without disposing it, leaking a controller object per rebuild.

---

<details>
<summary>Issues (4)</summary>

1. **Relief column always empty** — The web table and Flutter form both show a Relief/Resource field, but `store()` never writes `resource_id` to the scan record. The column will always render `—` in history. Either wire the field to a resource lookup, or remove the column and field from both surfaces to avoid confusing staff.

2. **Flutter controller leak in read-only fields** — `TextField(controller: TextEditingController(text: _familyHead), readOnly: true, ...)` and the equivalent Purok and Relief fields each allocate a new `TextEditingController` on every `build()` call without disposing it. These should be promoted to state-level controllers or replaced with a `ReadOnlyTextField` pattern that uses a regular controller updated in `_selectFamily()`.

3. **Scan status labels are inventory-oriented** — `check_in`, `check_out`, `audit`, `transfer` describe warehouse operations, not family relief distribution events. If the intent is to track whether a family's relief parcel was handed out, labels like `released`, `returned`, `verified` would match the domain. This may need a migration to add new enum values and a UI pass to rename the options.

4. **`scan_type` validation still requires one of the old inventory values** — Both controllers validate `scan_type` as `in:check_in,check_out,audit,transfer`. If the enum is renamed to reflect the family-relief context (see issue 3), the validation rules and migration must change in lockstep. As written, the API will reject any attempt to submit a more descriptive status value.

</details>

<details>
<summary>Details</summary>

### Relief field carries no data

The form and table both expose a "Relief / Resource" field. In the React page it renders:

```tsx
<input type="text" className="input-field bg-slate-50" value="" readOnly placeholder="—" />
```

The value is hardcoded to an empty string. In the Flutter `ScanPage` the corresponding widget is:

```dart
const TextField(
  readOnly: true,
  decoration: InputDecoration(
    labelText: 'Relief / Resource',
    hintText: '— linked via distribution record',
  ),
),
```

Neither the web form submission nor `save()` in Flutter sends a `resource_id`. The store endpoints don't write one either. So the scan record has no relief reference, and the history table column will always show `—` or fall back to `s.resource?.name` (also null). The note "Linked via family distribution record" is a placeholder explanation, not a working link. This needs either a resource selector wired to the form or the column/field removed.

### Flutter read-only controller leak

`_selectFamily()` updates `_familyHead` and `_purokName` as plain strings in state. The build method materializes them as:

```dart
TextField(
  controller: TextEditingController(text: _familyHead),
  readOnly: true,
  ...
),
```

Every call to `build()` — triggered by any `setState()` in the page — allocates two new `TextEditingController` objects that are never disposed. The correct fix is to hold them as fields, initialize in `initState()`, and update `.text` in `_selectFamily()`:

```dart
late final _familyHeadCtrl = TextEditingController();
late final _purokCtrl      = TextEditingController();

void _selectFamily(String? id) {
  ...
  _familyHeadCtrl.text = fam['head_name']?.toString() ?? '';
  _purokCtrl.text      = ...;
}
```

The Relief field is `const TextField(readOnly: true, ...)` with no controller — that one is safe because it never holds mutable text.

### Scan status taxonomy mismatch

The `scan_type` values are validated as `in:check_in,check_out,audit,transfer` in both controllers and rendered as dropdown options in both the web form and Flutter form. These labels originate from the resource-tracking domain. A family relief scan doesn't "check in" or "check out" a resource; it records that a parcel was distributed to a household. Using warehouse vocabulary in a distribution context makes the history table harder to interpret for field staff. The spec says "Scan Status Type" but keeps the same four options — this is worth confirming with the team before shipping.

</details>

---

<details>
<summary>File map</summary>

- `database/migrations/2026_10_14_000001_add_family_fields_to_qr_scans_table.php` — adds `family_id` FK, `scan_date`, `scan_time` columns to `qr_scans`
- `app/Models/QrScan.php` — adds `family_id`, `scan_date`, `scan_time` to `$fillable`; adds `family()` BelongsTo; adds `scan_date` cast
- `app/Http/Controllers/QrTrackingController.php` — drops inventory logic; eager-loads family+purok; maps flat purok string; passes families and locations to Inertia
- `app/Http/Controllers/Api/QrTrackingController.php` — drops inventory logic; accepts new fields; eager-loads family+purok in both `store()` and `index()`
- `resources/js/types/models.ts` — adds `family_id`, `scan_date`, `scan_time` to `QrScan`; adds `FamilyOption` interface
- `resources/js/pages/qr-tracking.tsx` — replaces resource-oriented form with family-oriented form; adds camera scanner, family dropdown, head/purok read-only fields, scan status, location, date, time; updates history table columns
- `staff_relief_distribution_application/lib/main.dart` — replaces `lookup()`-based `ScanPage` with family dropdown flow; adds read-only head/purok/relief fields, date/time pickers, location dropdown; updates `ScanHistoryPage` subtitle to show family data

Full diff: `git diff main` from the project root.

</details>
