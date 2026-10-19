<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $canonicalNames = array_map(fn ($number) => "Purok {$number}", range(1, 7));

            foreach (DB::table('locations')->orderBy('id')->get(['id']) as $location) {
                foreach ($canonicalNames as $name) {
                    $this->ensurePurok((int) $location->id, $name);
                }
            }

            $extraPuroks = DB::table('puroks')
                ->whereNotNull('location_id')
                ->whereNotIn('name', $canonicalNames)
                ->orderBy('id')
                ->get(['id', 'name', 'location_id', 'assigned_staff_id']);

            foreach ($extraPuroks as $extra) {
                $number = $this->purokNumber($extra->name);

                foreach (DB::table('families')->where('purok_id', $extra->id)->get(['id', 'location_id']) as $family) {
                    $locationId = (int) ($family->location_id ?: $extra->location_id);
                    $purokId = $this->ensurePurok($locationId, "Purok {$number}");

                    DB::table('families')->where('id', $family->id)->update([
                        'purok_id' => $purokId,
                        'location_id' => $locationId,
                    ]);
                }

                foreach (DB::table('users')->where('purok_id', $extra->id)->get(['id', 'location_id']) as $staff) {
                    $locationId = (int) ($staff->location_id ?: $extra->location_id);
                    $purokId = $this->ensurePurok($locationId, "Purok {$number}");

                    DB::table('users')->where('id', $staff->id)->update([
                        'purok_id' => $purokId,
                        'location_id' => $locationId,
                    ]);
                }

                if ($extra->assigned_staff_id !== null) {
                    DB::table('puroks')->where('id', $extra->id)->update(['assigned_staff_id' => null]);
                    $staff = DB::table('users')->where('id', $extra->assigned_staff_id)->first(['location_id']);
                    $locationId = (int) ($staff?->location_id ?: $extra->location_id);
                    $canonical = DB::table('puroks')
                        ->where('location_id', $locationId)
                        ->where('name', "Purok {$number}")
                        ->first(['id', 'assigned_staff_id']);

                    if ($canonical && ($canonical->assigned_staff_id === null || (int) $canonical->assigned_staff_id === (int) $extra->assigned_staff_id)) {
                        DB::table('puroks')->where('id', $canonical->id)->update([
                            'assigned_staff_id' => $extra->assigned_staff_id,
                        ]);
                    } else {
                        DB::table('users')->where('id', $extra->assigned_staff_id)->update([
                            'purok_id' => null,
                        ]);
                    }
                }

                DB::table('puroks')->where('id', $extra->id)->delete();
            }
        });
    }

    private function ensurePurok(int $locationId, string $name): int
    {
        $existing = DB::table('puroks')
            ->where('location_id', $locationId)
            ->where('name', $name)
            ->first(['id']);

        if ($existing) {
            return (int) $existing->id;
        }

        $now = now();

        return (int) DB::table('puroks')->insertGetId([
            'name' => $name,
            'code' => "LOC-{$locationId}-PUROK-".$this->purokNumber($name),
            'location_id' => $locationId,
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function purokNumber(string $name): int
    {
        if (preg_match('/(\d+)/', trim($name), $matches) === 1) {
            return min(7, max(1, (int) $matches[1]));
        }

        throw new RuntimeException("Cannot consolidate Purok '{$name}' because it has no number.");
    }

    public function down(): void
    {
        // Consolidated Purok records cannot be restored to their original rows.
    }
};
