<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            $table->boolean('excluded')->default(false)->after('claimed_by');
            $table->string('exclusion_reason')->nullable()->after('excluded');
        });
    }

    public function down(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            $table->dropColumn(['excluded', 'exclusion_reason']);
        });
    }
};
