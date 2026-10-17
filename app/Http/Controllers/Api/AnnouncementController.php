<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    /**
     * Announcements for staff: returns 'staff' and 'everyone' audience rows.
     */
    public function staffIndex(Request $request): JsonResponse
    {
        $announcements = Announcement::with('sender:id,name')
            ->whereIn('audience', ['staff', 'everyone'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['announcements' => $announcements]);
    }

    /**
     * Announcements for family/household accounts.
     * Returns 'family' and 'everyone' rows, plus 'barangay' rows scoped to the
     * family's registered location.
     */
    public function familyIndex(Request $request): JsonResponse
    {
        $family = $request->user();

        $query = Announcement::with('sender:id,name')
            ->where(function ($q) use ($family) {
                $q->whereIn('audience', ['family', 'everyone'])
                  ->orWhere(function ($inner) use ($family) {
                      $inner->where('audience', 'barangay')
                            ->where('location_id', $family?->location_id);
                  });
            })
            ->orderByDesc('created_at');

        return response()->json(['announcements' => $query->get()]);
    }
}