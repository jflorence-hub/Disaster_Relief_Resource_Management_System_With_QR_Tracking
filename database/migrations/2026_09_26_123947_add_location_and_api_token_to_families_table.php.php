<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->foreignId('location_id')
                ->nullable()
                ->after('purok_id')
                ->constrained('locations')
                ->nullOnDelete();

            $table->string('api_token', 64)
                ->nullable()
                ->unique()
                ->after('pin');
        });
    }

    public function down(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->dropForeign(['location_id']);
            $table->dropColumn(['location_id', 'api_token']);
        });
    }
};
