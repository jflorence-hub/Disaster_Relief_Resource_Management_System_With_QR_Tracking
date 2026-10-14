<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('reset_code_hash')->nullable()->after('password');
            $table->timestamp('reset_code_expires_at')->nullable()->after('reset_code_hash');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['reset_code_hash', 'reset_code_expires_at']);
        });
    }
};
