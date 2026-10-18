<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    /**
     * Announcements for staff: returns 'staff' and 'everyone' audience rows
     * scoped to the staff member's barangay (or unscoped rows).
     */
    public function staffIndex(Request $request): JsonResponse
    {
        $staff = $request->user();

        $announcements = Announcement::with('sender:id,name')
            ->whereIn('audience', ['staff', 'everyone'])
            ->where(function ($q) use ($staff) {
                $q->whereNull('location_id')
                  ->orWhere('location_id', $staff?->location_id);
            })
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['announcements' => $announcements]);
    }

    /**
     * Announcements for family/household accounts.
     * Returns 'family' and 'everyone' rows scoped to the family's location
     * (location_id IS NULL or matches the family's registered location).
     */
    public function familyIndex(Request $request): JsonResponse
    {
        $family = $request->user();

        $query = Announcement::with('sender:id,name')
            ->whereIn('audience', ['family', 'everyone'])
            ->where(function ($q) use ($family) {
                $q->whereNull('location_id')
                  ->orWhere('location_id', $family?->location_id);
            })
            ->orderByDesc('created_at');

        return response()->json(['announcements' => $query->get()]);
    }
}