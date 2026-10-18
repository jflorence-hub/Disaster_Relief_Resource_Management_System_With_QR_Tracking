<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resource_sets', function (Blueprint $table) {
            $table->unsignedInteger('num_sets')->default(1)->after('disaster');
            $table->unsignedInteger('sets_remaining')->nullable()->after('num_sets');
        });
    }

    public function down(): void
    {
        Schema::table('resource_sets', function (Blueprint $table) {
            $table->dropColumn(['num_sets', 'sets_remaining']);
        });
    }
};
