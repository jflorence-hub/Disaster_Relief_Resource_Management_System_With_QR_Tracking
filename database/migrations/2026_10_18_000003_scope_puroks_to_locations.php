<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('puroks', function (Blueprint $table) {
            $table->dropUnique('puroks_name_unique');
            $table->unique(['location_id', 'name']);
        });

        foreach (DB::table('locations')->orderBy('id')->get(['id']) as $location) {
            foreach (range(1, 7) as $number) {
                $this->ensurePurok($location->id, "Purok {$number}");
            }
        }

        foreach (DB::table('puroks')->whereNull('location_id')->orderBy('id')->get() as $legacyPurok) {
            $staff = DB::table('users')
                ->where('purok_id', $legacyPurok->id)
                ->whereNotNull('location_id')
                ->get(['id', 'location_id']);

            foreach ($staff as $member) {
                $purokId = $this->ensurePurok($member->location_id, $legacyPurok->name, $legacyPurok->status);
                DB::table('users')->where('id', $member->id)->update(['purok_id' => $purokId]);
                if ((int) $legacyPurok->assigned_staff_id === (int) $member->id) {
                    $assignedStaffId = DB::table('puroks')
                        ->where('id', $purokId)
                        ->value('assigned_staff_id');
                    DB::table('puroks')->where('id', $legacyPurok->id)->update(['assigned_staff_id' => null]);
                    if ($assignedStaffId === null || (int) $assignedStaffId === (int) $member->id) {
                        DB::table('puroks')->where('id', $purokId)->update(['assigned_staff_id' => $member->id]);
                    }
                }
            }

            $families = DB::table('families')
                ->where('purok_id', $legacyPurok->id)
                ->whereNotNull('location_id')
                ->get(['id', 'location_id']);

            foreach ($families as $family) {
                $purokId = $this->ensurePurok($family->location_id, $legacyPurok->name, $legacyPurok->status);
                DB::table('families')->where('id', $family->id)->update(['purok_id' => $purokId]);
            }
        }
    }

    private function ensurePurok(int $locationId, string $name, string $status = 'active'): int
    {
        $existing = DB::table('puroks')
            ->where('location_id', $locationId)
            ->where('name', $name)
            ->first(['id']);

        if ($existing) {
            return $existing->id;
        }

        $slug = Str::upper(Str::slug($name, '-'));
        $now = now();

        return DB::table('puroks')->insertGetId([
            'name' => $name,
            'code' => "LOC-{$locationId}-{$slug}",
            'location_id' => $locationId,
            'status' => $status,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::table('puroks', function (Blueprint $table) {
            $table->dropUnique(['location_id', 'name']);
        });
    }
};
