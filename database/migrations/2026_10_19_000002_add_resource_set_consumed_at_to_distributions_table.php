<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distributions') && ! Schema::hasColumn('distributions', 'resource_set_consumed_at')) {
            Schema::table('distributions', function (Blueprint $table) {
                $table->timestamp('resource_set_consumed_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('distributions') && Schema::hasColumn('distributions', 'resource_set_consumed_at')) {
            Schema::table('distributions', function (Blueprint $table) {
                $table->dropColumn('resource_set_consumed_at');
            });
        }
    }
};
