<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->string('captain_name')->nullable()->after('email');
            $table->string('captain_contact')->nullable()->after('captain_name');
            $table->string('captain_email')->nullable()->after('captain_contact');
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn(['captain_name', 'captain_contact', 'captain_email']);
        });
    }
};
