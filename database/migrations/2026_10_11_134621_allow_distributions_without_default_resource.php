<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('distributions', function (Blueprint $table) {
            // A family must be listed even when no default relief resource exists.
            $table->foreignId('resource_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Intentionally do not make resource_id NOT NULL again: rows created
        // while no default resource exists may legitimately contain NULL.
    }
};
