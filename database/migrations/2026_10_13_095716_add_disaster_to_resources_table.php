<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resources', function (Blueprint $table) {
            // Freeform disaster label (e.g. "Typhoon Carina", "Earthquake 2026").
            // Nullable so existing rows are unaffected.
            $table->string('disaster')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('resources', function (Blueprint $table) {
            $table->dropColumn('disaster');
        });
    }
};
