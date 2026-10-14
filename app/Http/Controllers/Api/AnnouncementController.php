<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\JsonResponse;

class AnnouncementController extends Controller
{
    /**
     * Announcements intended for staff.
     */
    public function staffIndex(): JsonResponse
    {
        $announcements = Announcement::with('sender:id,name')
            ->where('audience', 'staff')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'announcements' => $announcements,
        ]);
    }

    /**
     * Announcements intended for family/household accounts.
     */
    public function familyIndex(): JsonResponse
    {
        $announcements = Announcement::with('sender:id,name')
            ->where('audience', 'family')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'announcements' => $announcements,
        ]);
    }
}
