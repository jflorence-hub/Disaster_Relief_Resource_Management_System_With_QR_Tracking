<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('qr_scans') && ! Schema::hasColumn('qr_scans', 'distribution_id')) {
            Schema::table('qr_scans', function (Blueprint $table) {
                $table->foreignId('distribution_id')
                    ->nullable()
                    ->after('family_id')
                    ->constrained('distributions')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('qr_scans') && Schema::hasColumn('qr_scans', 'distribution_id')) {
            Schema::table('qr_scans', function (Blueprint $table) {
                $table->dropConstrainedForeignId('distribution_id');
            });
        }
    }
};
