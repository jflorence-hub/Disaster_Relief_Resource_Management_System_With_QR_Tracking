<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE qr_scans MODIFY COLUMN scan_type ENUM('released','returned','verified','check_in','check_out','audit','transfer','completed','pending','cancelled') NOT NULL DEFAULT 'completed'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE qr_scans MODIFY COLUMN scan_type ENUM('released','returned','verified','check_in','check_out','audit','transfer') NOT NULL DEFAULT 'released'");
    }
};
