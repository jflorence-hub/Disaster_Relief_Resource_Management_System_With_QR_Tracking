<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            $table->foreignId('resource_set_id')
                ->nullable()
                ->after('resource_id')
                ->constrained('resource_sets')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            $table->dropForeign(['resource_set_id']);
            $table->dropColumn('resource_set_id');
        });
    }
};
