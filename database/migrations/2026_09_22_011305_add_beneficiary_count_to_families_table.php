<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
public function up(): void
{
    Schema::table('families', function (Blueprint $table) {
        $table->unsignedInteger('beneficiary_count')->default(1)->after('phone');
    });
}

public function down(): void
{
    Schema::table('families', function (Blueprint $table) {
        $table->dropColumn('beneficiary_count');
    });
}
};