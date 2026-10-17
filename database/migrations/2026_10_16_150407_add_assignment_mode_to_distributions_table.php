<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            $table->string('assignment_mode')->nullable()->after('resource_set_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            $table->dropColumn('assignment_mode');
        });
    }
};
