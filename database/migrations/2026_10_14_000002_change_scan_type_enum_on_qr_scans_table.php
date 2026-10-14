<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the old CHECK constraint / enum and replace with new distribution-oriented values.
        // MySQL: ENUM columns can be altered with a plain MODIFY.
        DB::statement("ALTER TABLE qr_scans MODIFY COLUMN scan_type ENUM('released','returned','verified','check_in','check_out','audit','transfer') NOT NULL DEFAULT 'released'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE qr_scans MODIFY COLUMN scan_type ENUM('check_in','check_out','audit','transfer') NOT NULL DEFAULT 'check_in'");
    }
};
