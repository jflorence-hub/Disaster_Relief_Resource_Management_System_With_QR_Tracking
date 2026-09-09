<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE resources MODIFY category ENUM('food','water','medical','shelter','clothing','hygiene','tools','set','other') NOT NULL DEFAULT 'other'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE resources MODIFY category ENUM('food','water','medical','shelter','clothing','hygiene','tools','other') NOT NULL DEFAULT 'other'");
    }
};
