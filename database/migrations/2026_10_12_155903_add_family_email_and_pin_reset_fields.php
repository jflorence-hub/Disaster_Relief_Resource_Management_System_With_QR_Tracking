<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    public function up(): void
    {
        if (!\Illuminate\Support\Facades\Schema::hasColumn('families', 'api_token')) {
            \Illuminate\Support\Facades\Schema::table('families', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->string('api_token', 100)->nullable()->unique();
            });
        }

        if (!\Illuminate\Support\Facades\Schema::hasColumn('families', 'email')) {
            \Illuminate\Support\Facades\Schema::table('families', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->string('email')->nullable();
            });
        }

        if (!\Illuminate\Support\Facades\Schema::hasColumn('families', 'reset_code_hash')) {
            \Illuminate\Support\Facades\Schema::table('families', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->string('reset_code_hash')->nullable();
            });
        }

        if (!\Illuminate\Support\Facades\Schema::hasColumn('families', 'reset_code_expires_at')) {
            \Illuminate\Support\Facades\Schema::table('families', function (\Illuminate\Database\Schema\Blueprint $table) {
                $table->timestamp('reset_code_expires_at')->nullable();
            });
        }
    }

};
