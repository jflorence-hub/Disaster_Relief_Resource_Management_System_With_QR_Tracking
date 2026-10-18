<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Stores an array of preferred purok IDs submitted at registration time.
            // null = "no preference / any available".
            // purok_id on the user remains the ASSIGNED purok (set at approval, not registration).
            $table->json('preferred_purok_ids')->nullable()->after('purok_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('preferred_purok_ids');
        });
    }
};
