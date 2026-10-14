<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('qr_scans', function (Blueprint $table) {
            $table->foreignId('family_id')
                ->nullable()
                ->after('resource_id')
                ->constrained('families')
                ->nullOnDelete();

            $table->date('scan_date')->nullable()->after('notes');
            $table->string('scan_time', 10)->nullable()->after('scan_date');
        });
    }

    public function down(): void
    {
        Schema::table('qr_scans', function (Blueprint $table) {
            $table->dropForeign(['family_id']);
            $table->dropColumn(['family_id', 'scan_date', 'scan_time']);
        });
    }
};
