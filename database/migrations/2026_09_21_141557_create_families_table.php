<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('families', function (Blueprint $table) {
            $table->id();

            $table->string('family_id')->unique();

            $table->string('family_name');
            $table->string('head_name');

            // Optional because some families don't have a cellphone.
            $table->string('phone')->nullable();

            $table->text('address')->nullable();

            $table->foreignId('purok_id')
                ->constrained('puroks')
                ->cascadeOnDelete();

            // Hashed PIN for family mobile-app login.
            $table->string('pin');

            $table->enum('status', [
                'active',
                'inactive'
            ])->default('active');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('families');
    }
};