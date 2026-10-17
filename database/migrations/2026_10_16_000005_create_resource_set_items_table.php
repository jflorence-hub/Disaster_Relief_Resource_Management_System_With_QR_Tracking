<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resource_set_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('resource_set_id')
                ->constrained('resource_sets')
                ->cascadeOnDelete();
            $table->foreignId('resource_id')
                ->constrained('resources')
                ->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resource_set_items');
    }
};
