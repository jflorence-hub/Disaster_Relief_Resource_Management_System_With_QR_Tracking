<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('staff_messages')) {
            Schema::create('staff_messages', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('recipient_id')->constrained('users')->cascadeOnDelete();
                $table->text('message');
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
                $table->index(['sender_id', 'recipient_id', 'created_at'], 'staff_messages_conversation_idx');
            });
            return;
        }

        Schema::table('staff_messages', function (Blueprint $table) {
            if (!Schema::hasColumn('staff_messages', 'sender_id')) {
                $table->unsignedBigInteger('sender_id')->nullable()->after('id')->index();
            }
            if (!Schema::hasColumn('staff_messages', 'recipient_id')) {
                $table->unsignedBigInteger('recipient_id')->nullable()->after('sender_id')->index();
            }
            if (!Schema::hasColumn('staff_messages', 'message')) {
                $table->text('message')->nullable()->after('recipient_id');
            }
            if (!Schema::hasColumn('staff_messages', 'read_at')) {
                $table->timestamp('read_at')->nullable()->after('message');
            }
        });
    }

    public function down(): void
    {
        // Intentionally leave existing messages/table intact during rollback.
    }
};
