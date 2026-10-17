<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: add location_id column
        Schema::table('announcements', function (Blueprint $table) {
            $table->foreignId('location_id')
                ->nullable()
                ->nullOnDelete()
                ->constrained('locations')
                ->after('audience');
        });

        // Step 2: alter the audience enum to include 'everyone' and 'barangay'
        // MySQL requires re-declaring the full ENUM to add values.
        DB::statement("ALTER TABLE announcements MODIFY audience ENUM('family','staff','everyone','barangay') NOT NULL");
    }

    public function down(): void
    {
        // Revert audience values back before dropping column
        DB::statement("UPDATE announcements SET audience = 'staff' WHERE audience IN ('everyone','barangay')");
        DB::statement("ALTER TABLE announcements MODIFY audience ENUM('family','staff') NOT NULL");

        Schema::table('announcements', function (Blueprint $table) {
            $table->dropForeign(['location_id']);
            $table->dropColumn('location_id');
        });
    }
};