<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disaster_events', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('type', 100);
            $table->string('affected_area')->nullable();
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->string('status', 20)->default('active');
            $table->text('description')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('distribution_schedules', function (Blueprint $table) {
            $table->foreignId('disaster_event_id')
                ->nullable()
                ->after('scheduled_at')
                ->constrained('disaster_events')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('distribution_schedules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('disaster_event_id');
        });

        Schema::dropIfExists('disaster_events');
    }
};
