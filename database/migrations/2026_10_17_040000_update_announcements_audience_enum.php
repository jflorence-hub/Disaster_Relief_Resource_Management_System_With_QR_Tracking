<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: migrate existing 'barangay' audience rows to 'everyone'
        // (preserve their location_id)
        DB::statement("UPDATE announcements SET audience = 'everyone' WHERE audience = 'barangay'");

        // Step 2: remove 'barangay' from the enum
        DB::statement("ALTER TABLE announcements MODIFY audience ENUM('family','staff','everyone') NOT NULL DEFAULT 'everyone'");
    }

    public function down(): void
    {
        // Step 1: restore the barangay variant in the enum
        DB::statement("ALTER TABLE announcements MODIFY audience ENUM('family','staff','everyone','barangay') NOT NULL DEFAULT 'everyone'");

        // Step 2: re-classify 'everyone' rows with a location_id back to 'barangay'
        // (heuristic rollback — acceptable for development)
        DB::statement("UPDATE announcements SET audience = 'barangay' WHERE audience = 'everyone' AND location_id IS NOT NULL");
    }
};
