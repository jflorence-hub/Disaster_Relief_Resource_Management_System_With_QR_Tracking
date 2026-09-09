<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['admin', 'staff'])->default('staff')->after('email');
            $table->string('phone')->nullable()->after('role');
            $table->enum('status', ['active', 'on_leave', 'inactive'])->default('active')->after('phone');
            $table->foreignId('location_id')->nullable()->after('status')->constrained('locations')->nullOnDelete();
            $table->string('responsibilities')->nullable()->after('location_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('location_id');
            $table->dropColumn(['role', 'phone', 'status', 'responsibilities']);
        });
    }
};
