<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $families = DB::table('families')->orderBy('id')->get(['id']);

        foreach ($families as $family) {
            DB::table('families')->where('id', $family->id)->update([
                'family_id' => 'FAM-NORMALIZE-' . bin2hex(random_bytes(16)),
            ]);
        }

        foreach ($families as $family) {
            DB::table('families')->where('id', $family->id)->update([
                'family_id' => 'FAM-' . str_pad((string) $family->id, 4, '0', STR_PAD_LEFT),
            ]);
        }
    }

    public function down(): void
    {
        // Existing family IDs and names cannot be reconstructed after normalization.
    }
};
