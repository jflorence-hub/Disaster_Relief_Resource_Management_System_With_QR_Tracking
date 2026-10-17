<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('staff_id')->nullable()->unique()->after('id');
            $table->date('birthdate')->nullable()->after('must_change_password');
            $table->text('home_address')->nullable()->after('birthdate');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['staff_id']);
            $table->dropColumn(['staff_id', 'birthdate', 'home_address']);
        });
    }
};
