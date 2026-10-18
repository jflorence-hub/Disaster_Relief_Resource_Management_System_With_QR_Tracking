<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->dropColumn(['family_name', 'address']);
        });
    }

    public function down(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->string('family_name')->nullable();
            $table->text('address')->nullable();
        });

        DB::table('families')->update([
            'family_name' => DB::raw('head_name'),
        ]);
    }
};
