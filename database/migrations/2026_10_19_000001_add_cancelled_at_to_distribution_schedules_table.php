<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_schedules') && ! Schema::hasColumn('distribution_schedules', 'cancelled_at')) {
            Schema::table('distribution_schedules', function (Blueprint $table) {
                $table->timestamp('cancelled_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('distribution_schedules') && Schema::hasColumn('distribution_schedules', 'cancelled_at')) {
            Schema::table('distribution_schedules', function (Blueprint $table) {
                $table->dropColumn('cancelled_at');
            });
        }
    }
};
