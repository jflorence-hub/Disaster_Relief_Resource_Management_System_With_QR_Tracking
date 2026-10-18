<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use App\Models\Purok;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FamilyMessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $family = $request->user();
        $staff = $this->assignedStaff($family);
        $rows = DB::table('family_messages')
            ->where('family_id', $family->id)
            ->orderBy('created_at')
            ->get();

        if ($staff) {
            DB::table('family_messages')
                ->where('family_id', $family->id)
                ->where('staff_id', $staff->id)
                ->where('sender_type', 'admin')
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        }

        return response()->json([
            'messages' => $rows,
            'recipient' => $staff ? ['id' => $staff->id, 'name' => $staff->name] : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['message' => 'required|string|max:5000']);
        $family = $request->user();
        $staff = $this->assignedStaff($family);

        if (! $staff) {
            return response()->json([
                'message' => 'No active staff member is assigned to your Purok. Please contact the barangay office.',
            ], 422);
        }

        $id = DB::table('family_messages')->insertGetId([
            'family_id' => $family->id,
            'staff_id' => $staff->id,
            'admin_id' => null,
            'sender_type' => 'family',
            'message' => $data['message'], 'created_at' => now(), 'updated_at' => now(),
        ]);
        return response()->json([
            'message' => 'Message sent to your assigned Purok staff.',
            'item' => DB::table('family_messages')->find($id),
        ], 201);
    }

    private function assignedStaff(Family $family): ?\App\Models\User
    {
        $purok = $family->purok_id ? Purok::with('assignedStaff')->find($family->purok_id) : null;
        $staff = $purok?->assignedStaff;

        if (! $staff || $staff->role !== 'staff' || $staff->status !== 'active') {
            return null;
        }

        return $staff;
    }
}
