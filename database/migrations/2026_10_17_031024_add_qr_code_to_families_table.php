<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use App\Models\Family;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->string('qr_code', 30)->nullable()->unique()->after('status');
        });

        // Backfill: generate a unique QR code for every existing family
        Family::whereNull('qr_code')->orderBy('id')->each(function (Family $family) {
            do {
                $candidate = 'FAM-QR-' . strtoupper(Str::random(10));
            } while (Family::where('qr_code', $candidate)->exists());

            $family->update(['qr_code' => $candidate]);
        });
    }

    public function down(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->dropColumn('qr_code');
        });
    }
};