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
        Schema::table('distributions', function (Blueprint $table) {
            $table->foreignId('additional_resource_id')->nullable()->after('resource_id')
                ->constrained('resources')->nullOnDelete();
            $table->unsignedInteger('additional_quantity')->nullable()->after('quantity');
            $table->string('qr_code')->nullable()->unique()->after('id');
        });

        // Backfill any existing distribution records with a unique QR code
        // so historical data isn't left without one.
        DB::table('distributions')->whereNull('qr_code')->orderBy('id')->pluck('id')->each(function ($id) {
            DB::table('distributions')->where('id', $id)->update([
                'qr_code' => 'DIST-'.strtoupper(Str::random(10)),
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('additional_resource_id');
            $table->dropColumn(['additional_quantity', 'qr_code']);
        });
    }
};
