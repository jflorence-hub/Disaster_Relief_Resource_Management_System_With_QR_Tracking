<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('qr_scans', function (Blueprint $table) {
            $table->foreignId('resource_id')->nullable()->change();
            $table->string('resource_label')->nullable()->after('resource_id');
        });
    }

    public function down(): void
    {
        Schema::table('qr_scans', function (Blueprint $table) {
            $table->dropColumn('resource_label');
            $table->foreignId('resource_id')->nullable(false)->change();
        });
    }
};
