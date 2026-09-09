<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resources', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('category', ['food', 'water', 'medical', 'shelter', 'clothing', 'hygiene', 'tools', 'other'])->default('other');
            $table->string('sku')->unique();
            $table->string('qr_code')->unique();
            $table->unsignedInteger('quantity')->default(0);
            $table->string('unit')->default('pieces');
            $table->unsignedInteger('minimum_threshold')->default(10);
            $table->date('expiry_date')->nullable();
            $table->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resources');
    }
};
