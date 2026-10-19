<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE families MODIFY COLUMN status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::table('families')
                ->where('status', 'pending')
                ->update(['status' => 'inactive']);

            DB::statement("ALTER TABLE families MODIFY COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active'");
        }
    }
};
