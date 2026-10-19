<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Models\Family;
use App\Models\HouseholdMember;
use App\Models\Location;
use App\Models\Purok;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use PhpOffice\PhpSpreadsheet\IOFactory;
use App\Jobs\SendFamilyTemporaryPin;

class FamilyImportController extends Controller
{
    public function index(): InertiaResponse
    {
        $deliveries = DB::table('family_credential_deliveries')
            ->join('families', 'families.id', '=', 'family_credential_deliveries.family_id')
            ->orderByDesc('family_credential_deliveries.created_at')
            ->limit(100)
            ->get([
                'family_credential_deliveries.id',
                'families.head_name',
                'family_credential_deliveries.recipient_email as email',
                'family_credential_deliveries.status',
                'family_credential_deliveries.attempts',
                'family_credential_deliveries.last_error',
                'family_credential_deliveries.sent_at',
            ]);

        return Inertia::render('import-families', ['initialDeliveries' => $deliveries]);
    }

    // --- Template download ----------------------------------------------------

    public function template(): Response
    {
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Header metadata block (rows 1-8) — matches the Add Location modal
        $sheet->setCellValue('A1', 'Barangay Name');
        $sheet->setCellValue('B1', 'Barangay San Isidro');
        $sheet->setCellValue('A2', 'Barangay Captain Name');
        $sheet->setCellValue('B2', 'Juan Dela Cruz');
        $sheet->setCellValue('A3', 'Barangay Captain Contact');
        $sheet->setCellValue('B3', '09171234567');
        $sheet->setCellValue('A4', 'Barangay Captain Email');
        $sheet->setCellValue('B4', 'captain@example.com');
        $sheet->setCellValue('A5', 'Location Type');
        $sheet->setCellValue('B5', 'distribution_center');
        $sheet->setCellValue('A6', 'Address');
        $sheet->setCellValue('B6', 'Barangay San Isidro, Ormoc City');
        $sheet->setCellValue('A7', 'City');
        $sheet->setCellValue('B7', 'Ormoc City');
        $sheet->setCellValue('A8', 'Capacity');
        $sheet->setCellValue('B8', '0');
        $sheet->setCellValue('A9', 'Operational Status');
        $sheet->setCellValue('B9', 'active');

        // Column headers (row 11)
        $headers = ['A' => 'head_firstname', 'B' => 'head_lastname', 'C' => 'household_members', 'D' => 'purok', 'E' => 'phone', 'F' => 'email'];
        foreach ($headers as $col => $header) {
            $sheet->setCellValue("{$col}11", $header);
        }

        // Sample data row (row 12)
        $sample = ['A' => 'Juan', 'B' => 'Dela Cruz', 'C' => 'Maria Dela Cruz, Jose Dela Cruz', 'D' => 'Purok 1', 'E' => '09181234567', 'F' => 'family@example.com'];
        foreach ($sample as $col => $val) {
            $sheet->setCellValue("{$col}12", $val);
        }

        $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
        ob_start();
        $writer->save('php://output');
        $content = ob_get_clean();

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="family_import_template.xlsx"',
        ]);
    }

    // --- Preview --------------------------------------------------------------

    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240',
        ]);

        try {
            [$meta, $rows, $errors] = $this->parseFile($request->file('file'));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not parse file: ' . $e->getMessage()], 422);
        }

        // Let the frontend know whether this barangay already exists,
        // so it can show the appropriate confirmation message.
        $locationExists = ! empty($meta['barangay_name'])
            && Location::whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($meta['barangay_name']))])->exists();

        $mailer = config('mail.default');
        $emailTransportConfigured = ! in_array($mailer, ['log', 'array', 'failover'], true)
            && filter_var(config('mail.from.address'), FILTER_VALIDATE_EMAIL);
        if ($mailer === 'smtp') {
            $emailTransportConfigured = $emailTransportConfigured
                && config('mail.mailers.smtp.host') !== '127.0.0.1'
                && filled(config('mail.mailers.smtp.host'));
        }

        return response()->json(compact('meta', 'rows', 'errors', 'locationExists', 'emailTransportConfigured'));
    }

    // --- Confirm / import -----------------------------------------------------

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240',
        ]);

        try {
            [$meta, $rows, $parseErrors] = $this->parseFile($request->file('file'));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not parse file: ' . $e->getMessage()], 422);
        }

        $location = $this->resolveLocation($meta);
        $imported = 0;
        $skipped  = 0;
        $errors   = $parseErrors;
        $notifications = [];

        DB::transaction(function () use ($rows, $location, &$imported, &$skipped, &$errors, &$notifications) {
            foreach ($rows as $row) {
                if (! empty($row['_error'])) {
                    $skipped++;
                    continue;
                }
                try {
                    $notifications[] = $this->importRow($row, $location);
                    $imported++;
                } catch (\Throwable $e) {
                    $errors[] = ['row' => $row['_row_number'], 'reason' => $e->getMessage()];
                    $skipped++;
                    Log::warning("Family import row {$row['_row_number']} failed: " . $e->getMessage());
                }
            }
        });

        return response()->json(compact('imported', 'skipped', 'errors', 'notifications'));
    }

    public function deliveryStatuses(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1|max:100',
            'ids.*' => 'required|integer|distinct',
        ]);

        $deliveries = DB::table('family_credential_deliveries')
            ->join('families', 'families.id', '=', 'family_credential_deliveries.family_id')
            ->whereIn('family_credential_deliveries.id', $data['ids'])
            ->get([
                'family_credential_deliveries.id',
                'families.head_name',
                'family_credential_deliveries.recipient_email as email',
                'family_credential_deliveries.status',
                'family_credential_deliveries.attempts',
                'family_credential_deliveries.last_error',
                'family_credential_deliveries.sent_at',
            ]);

        return response()->json(['deliveries' => $deliveries]);
    }

    public function retryDelivery(int $deliveryId): JsonResponse
    {
        $delivery = DB::table('family_credential_deliveries')->where('id', $deliveryId)->first();
        abort_unless($delivery, 404);
        abort_unless($delivery->status === 'failed', 409, 'Only failed credential emails can be retried.');

        $updated = DB::table('family_credential_deliveries')
            ->where('id', $deliveryId)
            ->where('status', 'failed')
            ->update([
            'status' => 'pending',
            'last_error' => null,
            'updated_at' => now(),
        ]);
        abort_unless($updated === 1, 409, 'Only failed credential emails can be retried.');
        SendFamilyTemporaryPin::dispatch($deliveryId);

        return response()->json(['message' => 'Credential email queued for retry.']);
    }

    // --- Private helpers ------------------------------------------------------

    private function parseFile(\Illuminate\Http\UploadedFile $file): array
    {
        $spreadsheet = IOFactory::load($file->getRealPath());
        $sheet       = $spreadsheet->getActiveSheet();

        // Build a 0-indexed array from the sheet rows
        $data = [];
        foreach ($sheet->getRowIterator() as $row) {
            $cellIterator = $row->getCellIterator();
            $cellIterator->setIterateOnlyExistingCells(false);
            $cells = [];
            foreach ($cellIterator as $cell) {
                $cells[] = $cell->getValue();
            }
            $data[] = $cells;
        }

        // Rows 1-9 (indices 0-8): metadata - [label, value]
        // Extended to match the Add Location modal; backward compatible with
        // old templates that only had rows 1-4.
        $meta = [
            'barangay_name'   => trim((string) ($data[0][1] ?? '')),
            'captain_name'    => trim((string) ($data[1][1] ?? '')),
            'captain_contact' => trim((string) ($data[2][1] ?? '')),
            'captain_email'   => trim((string) ($data[3][1] ?? '')),
            'type'            => trim((string) ($data[4][1] ?? '')) ?: 'distribution_center',
            'address'         => trim((string) ($data[5][1] ?? '')),
            'city'            => trim((string) ($data[6][1] ?? '')),
            'capacity'        => trim((string) ($data[7][1] ?? '')),
            'status'          => trim((string) ($data[8][1] ?? '')) ?: 'active',
        ];

        // Find the header row dynamically: scan for 'head_firstname' in any
        // row rather than assuming a fixed position. This supports both the
        // old template (headers at row 6 / index 5) and the new template
        // (headers at row 11 / index 10).
        $headerRowIndex = null;
        foreach ($data as $idx => $row) {
            $rowLower = array_map('strtolower', array_map('trim', array_map('strval', $row)));
            if (in_array('head_firstname', $rowLower, true)) {
                $headerRowIndex = $idx;
                break;
            }
        }
        if ($headerRowIndex === null) {
            throw new \RuntimeException('Could not find the column header row (looking for "head_firstname").');
        }

        $headerRow = array_map('strtolower', array_map('trim', array_map('strval', $data[$headerRowIndex])));
        $colMap    = array_flip($headerRow);

        $required = ['head_firstname', 'head_lastname', 'purok'];
        foreach ($required as $col) {
            if (! isset($colMap[$col])) {
                throw new \RuntimeException("Missing required column \"{$col}\" in row " . ($headerRowIndex + 1) . ".");
            }
        }

        $rows   = [];
        $errors = [];
        $existingEmails = DB::table('families')
            ->whereNotNull('email')
            ->pluck('email')
            ->merge(DB::table('household_members')->whereNotNull('email')->pluck('email'))
            ->map(fn ($email) => strtolower(trim((string) $email)))
            ->flip();
        $seenEmails = [];

        for ($i = $headerRowIndex + 1; $i < count($data); $i++) {
            $rawRow    = $data[$i];
            $rowNumber = $i + 1;

            if (empty(array_filter(array_map('trim', array_map('strval', $rawRow))))) {
                continue;
            }

            $get = fn(string $key) => trim((string) ($rawRow[$colMap[$key] ?? -1] ?? ''));

            $headFirst  = $get('head_firstname');
            $headLast   = $get('head_lastname');
            $purokName  = $get('purok');
            $membersRaw = isset($colMap['household_members']) ? $get('household_members') : '';
            $phone      = isset($colMap['phone']) ? $get('phone') : '';
            $email      = isset($colMap['email']) ? strtolower($get('email')) : '';
            $purokMatches = [];
            $validPurok = preg_match('/^purok\s*([1-7])$/i', $purokName, $purokMatches) === 1;

            $rowError = null;
            if (empty($headFirst) || empty($headLast)) {
                $rowError = 'Missing head_firstname or head_lastname.';
            } elseif (empty($purokName)) {
                $rowError = 'Missing purok.';
            } elseif (! $validPurok) {
                $rowError = 'Purok must be numbered 1 through 7.';
            } elseif (empty($email)) {
                $rowError = 'Missing email — email is required because the temporary PIN is sent by email.';
            } elseif (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $rowError = 'Invalid email address.';
            } elseif (isset($existingEmails[strtolower($email)])) {
                $rowError = 'Email is already used by another family or member account.';
            } elseif (isset($seenEmails[strtolower($email)])) {
                $rowError = 'Email is duplicated in this import file.';
            }
            if ($email !== '' && ! $rowError) {
                $seenEmails[strtolower($email)] = true;
            }
            if ($validPurok) {
                $purokName = "Purok {$purokMatches[1]}";
            }

            $memberNames = [];
            if (! empty($membersRaw)) {
                $memberNames = array_values(array_filter(
                    array_map('trim', explode(',', $membersRaw)),
                    fn ($n) => $n !== ''
                ));
            }

            $row = [
                '_row_number'    => $rowNumber,
                '_error'         => $rowError,
                'head_firstname' => $headFirst,
                'head_lastname'  => $headLast,
                'head_name'      => trim("{$headFirst} {$headLast}"),
                'purok_name'     => $purokName,
                'member_names'   => $memberNames,
                'member_count'   => count($memberNames),
                'phone'          => $phone ?: null,
                'email'          => $email ?: null,
            ];

            if ($rowError) {
                $errors[] = ['row' => $rowNumber, 'reason' => $rowError];
            }

            $rows[] = $row;
        }

        return [$meta, $rows, $errors];
    }

    private function resolveLocation(array $meta): Location
    {
        $name = $meta['barangay_name'];
        if (empty($name)) {
            throw new \RuntimeException('Barangay Name is missing from the file header (row 1).');
        }

        $location = Location::whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($name))])->first();

        if ($location) {
            // Update all location fields from the file — do not overwrite with blank values.
            // Uses the same column names as the Add Location modal so edits are visible in the UI.
            $updates = array_filter([
                'contact_person' => $meta['captain_name']    ?: null,
                'contact_phone'  => $meta['captain_contact'] ?: null,
                'email'          => $meta['captain_email']   ?: null,
                // captain_* columns kept in sync for API / legacy compatibility
                'captain_name'    => $meta['captain_name']    ?: null,
                'captain_contact' => $meta['captain_contact'] ?: null,
                'captain_email'   => $meta['captain_email']   ?: null,
                // Modal fields that can be updated from the import file
                'type'     => $meta['type']     ?: null,
                'address'  => $meta['address']  ?: null,
                'city'     => $meta['city']     ?: null,
                'capacity' => is_numeric($meta['capacity']) ? (int) $meta['capacity'] : null,
                'status'   => $meta['status']   ?: null,
            ], fn ($v) => $v !== null);

            if (! empty($updates)) {
                $location->update($updates);
            }

            return $location;
        }

        // New barangay — captain name, contact, and email are required
        $missing = [];
        if (empty($meta['captain_name']))    $missing[] = 'Barangay Captain Name (row 2)';
        if (empty($meta['captain_contact'])) $missing[] = 'Barangay Captain Contact (row 3)';
        if (empty($meta['captain_email']))   $missing[] = 'Barangay Captain Email (row 4)';

        if (! empty($missing)) {
            throw new \RuntimeException(
                'New barangay "' . $name . '" requires the following missing fields: ' . implode(', ', $missing) . '.'
            );
        }

        // Derive sensible defaults for fields not present in old templates
        $address  = $meta['address']  ?: $name;
        $city     = $meta['city']     ?: $name;
        $type     = in_array($meta['type'], ['warehouse', 'distribution_center', 'shelter', 'field_office'], true)
                        ? $meta['type'] : 'distribution_center';
        $status   = in_array($meta['status'], ['active', 'inactive', 'maintenance'], true)
                        ? $meta['status'] : 'active';
        $capacity = is_numeric($meta['capacity']) ? (int) $meta['capacity'] : 0;

        $location = Location::create([
            'name'            => $name,
            'type'            => $type,
            'address'         => $address,
            'city'            => $city,
            'capacity'        => $capacity,
            'status'          => $status,
            // Modal columns
            'contact_person'  => $meta['captain_name'],
            'contact_phone'   => $meta['captain_contact'],
            'email'           => $meta['captain_email'],
            // Legacy API columns kept in sync
            'captain_name'    => $meta['captain_name'],
            'captain_contact' => $meta['captain_contact'],
            'captain_email'   => $meta['captain_email'],
        ]);

        return $location;
    }

    private function importRow(array $row, Location $location): array
    {
        $purok = Purok::where('name', $row['purok_name'])
            ->where('location_id', $location->id)
            ->where('status', 'active')
            ->first();

        if (! $purok) {
            throw new \RuntimeException("{$row['purok_name']} is not configured for {$location->name}.");
        }

        $headName  = $row['head_name'];
        $duplicate = Family::whereRaw('LOWER(TRIM(head_name)) = ?', [strtolower($headName)])->exists();
        if ($duplicate) {
            throw new \RuntimeException("Head name \"{$headName}\" is already registered.");
        }

        $email = strtolower(trim((string) $row['email']));
        if (empty($email)) {
            throw new \RuntimeException("Email is required for \"{$headName}\" — the temporary PIN is sent by email.");
        }

        // Check for duplicate email across family and member accounts.
        $existingEmail = Family::whereRaw('LOWER(email) = ?', [strtolower($email)])->exists()
            || HouseholdMember::whereRaw('LOWER(email) = ?', [strtolower($email)])->exists();
        if ($existingEmail) {
            throw new \RuntimeException("Email \"{$email}\" is already registered to another family.");
        }

        // Generate a plaintext PIN to email, and a hashed copy for the DB
        $plainPin = $this->generatePin();

        $family = Family::create([
            'head_name'        => $headName,
            'phone'            => $row['phone'],
            'email'            => $email,
            'household_member' => max(1, $row['member_count']),
            'purok_id'         => $purok->id,
            'location_id'      => $location->id,
            'pin'              => Hash::make($plainPin),
            'must_change_pin'  => true,
            'status'           => 'active',
        ]);

        $deliveryId = DB::table('family_credential_deliveries')->insertGetId([
            'family_id' => $family->id,
            'recipient_email' => $email,
            'pin_encrypted' => Crypt::encryptString($plainPin),
            'status' => 'pending',
            'attempts' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        SendFamilyTemporaryPin::dispatch($deliveryId)->afterCommit();

        foreach ($row['member_names'] as $idx => $name) {
            HouseholdMember::create([
                'family_id'               => $family->id,
                'household_member_number' => $idx + 1,
                'name'                    => $name,
            ]);
        }

        $scheduledAt = DB::table('distribution_schedules')->orderByDesc('id')->value('scheduled_at') ?? now();
        Distribution::create([
            'family_id'         => $family->id,
            'resource_id'       => null,
            'quantity'          => max(1, (int) ceil($family->household_member / 3)),
            'location_id'       => $location->id,
            'distribution_date' => $scheduledAt,
            'recipient_name'    => $family->head_name,
            'recipient_contact' => $family->phone,
            'household_member'  => $family->household_member,
            'status'            => 'pending',
        ]);

        return [
            'id' => $deliveryId,
            'head_name' => $headName,
            'email' => $email,
            'status' => 'pending',
            'attempts' => 0,
            'last_error' => null,
            'sent_at' => null,
        ];
    }

    private function generatePin(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}