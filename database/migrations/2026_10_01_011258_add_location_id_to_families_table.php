<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('families', 'location_id')) {
            Schema::table('families', function (Blueprint $table) {
                $table->foreignId('location_id')->nullable()->after('purok_id')->constrained('locations')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Keep the column in place because an earlier migration may own it.

    }
};