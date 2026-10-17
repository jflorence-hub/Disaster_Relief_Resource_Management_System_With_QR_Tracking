<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resource_sets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('location_id')
                ->nullable()
                ->constrained('locations')
                ->nullOnDelete();
            $table->string('disaster')->nullable();
            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resource_sets');
    }
};
