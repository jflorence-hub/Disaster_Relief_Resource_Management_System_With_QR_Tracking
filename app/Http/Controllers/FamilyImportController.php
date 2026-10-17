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
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;

class FamilyImportController extends Controller
{
    // --- Template download ----------------------------------------------------

    public function template(): Response
    {
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Header metadata block (rows 1-4)
        $sheet->setCellValue('A1', 'Barangay Name');
        $sheet->setCellValue('B1', 'Barangay San Isidro');
        $sheet->setCellValue('A2', 'Barangay Captain Name');
        $sheet->setCellValue('B2', 'Juan Dela Cruz');
        $sheet->setCellValue('A3', 'Barangay Captain Contact');
        $sheet->setCellValue('B3', '09171234567');
        $sheet->setCellValue('A4', 'Barangay Captain Email');
        $sheet->setCellValue('B4', 'captain@example.com');

        // Column headers (row 6)
        $headers = ['A' => 'head_firstname', 'B' => 'head_lastname', 'C' => 'household_members', 'D' => 'purok', 'E' => 'phone', 'F' => 'email'];
        foreach ($headers as $col => $header) {
            $sheet->setCellValue("{$col}6", $header);
        }

        // Sample data row (row 7)
        $sample = ['A' => 'Juan', 'B' => 'Dela Cruz', 'C' => 'Maria Dela Cruz, Jose Dela Cruz', 'D' => 'Purok 1', 'E' => '09181234567', 'F' => 'family@example.com'];
        foreach ($sample as $col => $val) {
            $sheet->setCellValue("{$col}7", $val);
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

        return response()->json(compact('meta', 'rows', 'errors', 'locationExists'));
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

        DB::transaction(function () use ($rows, $location, &$imported, &$skipped, &$errors) {
            foreach ($rows as $row) {
                if (! empty($row['_error'])) {
                    $skipped++;
                    continue;
                }
                try {
                    $this->importRow($row, $location);
                    $imported++;
                } catch (\Throwable $e) {
                    $errors[] = ['row' => $row['_row_number'], 'reason' => $e->getMessage()];
                    $skipped++;
                    Log::warning("Family import row {$row['_row_number']} failed: " . $e->getMessage());
                }
            }
        });

        return response()->json(compact('imported', 'skipped', 'errors'));
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

        // Rows 1-4 (indices 0-3): metadata - [label, value]
        $meta = [
            'barangay_name'   => trim((string) ($data[0][1] ?? '')),
            'captain_name'    => trim((string) ($data[1][1] ?? '')),
            'captain_contact' => trim((string) ($data[2][1] ?? '')),
            'captain_email'   => trim((string) ($data[3][1] ?? '')),
        ];

        // Row 6 (index 5): column headers
        $headerRow = array_map('strtolower', array_map('trim', array_map('strval', $data[5] ?? [])));
        $colMap    = array_flip($headerRow);

        $required = ['head_firstname', 'head_lastname', 'purok'];
        foreach ($required as $col) {
            if (! isset($colMap[$col])) {
                throw new \RuntimeException("Missing required column \"{$col}\" in row 6.");
            }
        }

        $rows   = [];
        $errors = [];

        for ($i = 6; $i < count($data); $i++) {
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
            $email      = isset($colMap['email']) ? $get('email') : '';

            $rowError = null;
            if (empty($headFirst) || empty($headLast)) {
                $rowError = 'Missing head_firstname or head_lastname.';
            } elseif (empty($purokName)) {
                $rowError = 'Missing purok.';
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
            // Update captain fields from the file — do not overwrite with blank values
            $updates = array_filter([
                'captain_name'    => $meta['captain_name']    ?: null,
                'captain_contact' => $meta['captain_contact'] ?: null,
                'captain_email'   => $meta['captain_email']   ?: null,
            ], fn ($v) => $v !== null);

            if (! empty($updates)) {
                $location->update($updates);
            }

            return $location;
        }

        // New barangay — all 4 header fields are required before creating
        $missing = [];
        if (empty($meta['captain_name']))    $missing[] = 'Barangay Captain Name (row 2)';
        if (empty($meta['captain_contact'])) $missing[] = 'Barangay Captain Contact (row 3)';
        if (empty($meta['captain_email']))   $missing[] = 'Barangay Captain Email (row 4)';

        if (! empty($missing)) {
            throw new \RuntimeException(
                'New barangay "' . $name . '" requires the following missing fields: ' . implode(', ', $missing) . '.'
            );
        }

        return Location::create([
            'name'            => $name,
            'type'            => 'distribution_center',
            'address'         => $name,
            'city'            => $name,
            'status'          => 'active',
            'captain_name'    => $meta['captain_name'],
            'captain_contact' => $meta['captain_contact'],
            'captain_email'   => $meta['captain_email'],
        ]);
    }

    private function importRow(array $row, Location $location): void
    {
        $purok = Purok::whereRaw('LOWER(TRIM(name)) = ?', [strtolower($row['purok_name'])])
            ->where('location_id', $location->id)
            ->first();

        // Auto-create the purok under this location if it does not exist yet.
        // This ensures imported puroks are always scoped to the correct barangay.
        if (! $purok) {
            $purok = Purok::create([
                'name'        => $row['purok_name'],
                'location_id' => $location->id,
                'status'      => 'active',
            ]);
        }

        $headName  = $row['head_name'];
        $duplicate = Family::whereRaw('LOWER(TRIM(head_name)) = ?', [strtolower($headName)])->exists();
        if ($duplicate) {
            throw new \RuntimeException("Head name \"{$headName}\" is already registered.");
        }

        $family = Family::create([
            'family_id'        => 'FAM-IMPORT-' . Str::random(8),
            'family_name'      => $headName . ' Family',
            'head_name'        => $headName,
            'phone'            => $row['phone'],
            'household_member' => max(1, $row['member_count']),
            'purok_id'         => $purok->id,
            'location_id'      => $location->id,
            'pin'              => Hash::make($this->generatePin()),
            'status'           => 'active',
        ]);

        $family->update(['family_id' => 'FAM-' . str_pad((string) $family->id, 4, '0', STR_PAD_LEFT)]);

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
            'recipient_name'    => $family->family_name,
            'recipient_contact' => $family->phone,
            'household_member'  => $family->household_member,
            'status'            => 'pending',
        ]);
    }

    private function generatePin(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
}