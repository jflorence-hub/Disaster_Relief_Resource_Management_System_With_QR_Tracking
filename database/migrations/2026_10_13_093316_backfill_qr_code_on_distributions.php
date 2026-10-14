<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // Fill in qr_code for any distribution rows that are missing it.
        // The model's booted() hook handles new rows going forward, but rows
        // inserted before the hook existed (or via raw DB queries) have NULL.
        \DB::table('distributions')
            ->whereNull('qr_code')
            ->orderBy('id')
            ->each(function ($row) {
                \DB::table('distributions')
                    ->where('id', $row->id)
                    ->update([
                        'qr_code' => 'DIST-' . strtoupper(Str::random(10)),
                    ]);
            });
    }

    public function down(): void
    {
        // Not reversible — we do not want to null out existing QR codes.
    }
};
