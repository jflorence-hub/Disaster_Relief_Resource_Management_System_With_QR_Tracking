<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('household_members')) {
            return;
        }

        Schema::table('household_members', function (Blueprint $table) {
            if (! Schema::hasColumn('household_members', 'email')) {
                $table->string('email')->nullable()->unique();
            }
            if (! Schema::hasColumn('household_members', 'phone')) {
                $table->string('phone', 50)->nullable()->unique();
            }
            if (! Schema::hasColumn('household_members', 'password')) {
                $table->string('password')->nullable();
            }
            if (! Schema::hasColumn('household_members', 'api_token')) {
                $table->string('api_token', 64)->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('household_members')) {
            return;
        }

        Schema::table('household_members', function (Blueprint $table) {
            if (Schema::hasColumn('household_members', 'api_token')) {
                $table->dropIndex(['api_token']);
                $table->dropColumn('api_token');
            }
            if (Schema::hasColumn('household_members', 'password')) {
                $table->dropColumn('password');
            }
            if (Schema::hasColumn('household_members', 'phone')) {
                $table->dropUnique(['phone']);
                $table->dropColumn('phone');
            }
            if (Schema::hasColumn('household_members', 'email')) {
                $table->dropUnique(['email']);
                $table->dropColumn('email');
            }
        });
    }
};
