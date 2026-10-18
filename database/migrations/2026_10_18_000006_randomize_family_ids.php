<?php

use App\Models\Family;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            DB::table('families')
                ->select('id')
                ->orderBy('id')
                ->chunkById(500, function ($families): void {
                    foreach ($families as $family) {
                        DB::table('families')
                            ->where('id', $family->id)
                            ->update(['family_id' => 'TEMP-FAMILY-' . Str::uuid()]);
                    }
                });

            DB::table('families')
                ->select('id')
                ->orderBy('id')
                ->chunkById(500, function ($families): void {
                    foreach ($families as $family) {
                        DB::table('families')
                            ->where('id', $family->id)
                            ->update(['family_id' => Family::generateUniqueFamilyId()]);
                    }
                });
        });
    }

    public function down(): void
    {
        // Previously assigned random IDs cannot be reconstructed.
    }
};
