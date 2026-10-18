<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('family_messages') || Schema::hasColumn('family_messages', 'staff_id')) {
            return;
        }

        Schema::table('family_messages', function (Blueprint $table) {
            $table->foreignId('staff_id')
                ->nullable()
                ->after('family_id')
                ->constrained('users')
                ->nullOnDelete();
        });

        DB::table('family_messages')
            ->join('families', 'families.id', '=', 'family_messages.family_id')
            ->join('puroks', 'puroks.id', '=', 'families.purok_id')
            ->whereNull('family_messages.staff_id')
            ->update(['family_messages.staff_id' => DB::raw('puroks.assigned_staff_id')]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('family_messages') || ! Schema::hasColumn('family_messages', 'staff_id')) {
            return;
        }

        Schema::table('family_messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('staff_id');
        });
    }
};
