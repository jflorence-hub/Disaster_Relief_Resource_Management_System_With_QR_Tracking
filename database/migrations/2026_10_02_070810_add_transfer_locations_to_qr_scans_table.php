<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('qr_scans', function (Blueprint $table) {

            $table->foreignId('from_location_id')
                ->nullable()
                ->after('location_id')
                ->constrained('locations')
                ->nullOnDelete();

            $table->foreignId('to_location_id')
                ->nullable()
                ->after('from_location_id')
                ->constrained('locations')
                ->nullOnDelete();

            $table->foreignId('destination_resource_id')
                ->nullable()
                ->after('resource_id')
                ->constrained('resources')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('qr_scans', function (Blueprint $table) {

            $table->dropForeign([
                'from_location_id'
            ]);

            $table->dropForeign([
                'to_location_id'
            ]);

            $table->dropForeign([
                'destination_resource_id'
            ]);

            $table->dropColumn([
                'from_location_id',
                'to_location_id',
                'destination_resource_id'
            ]);
        });
    }
};