<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\Location;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementController extends Controller
{
    /**
     * Display all announcements, newest first.
     */
    public function index(): Response
    {
        $announcements = Announcement::with(['sender:id,name', 'location:id,name'])
            ->orderByDesc('created_at')
            ->get();

        return Inertia::render('announcements', [
            'announcements' => $announcements,
            'userRole'      => auth()->user()?->role,
            'locations'     => Location::where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    /**
     * Create a new announcement.
     * Supports audience: everyone, staff, family, barangay.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title'       => ['required', 'string', 'max:255'],
            'body'        => ['required', 'string'],
            'audience'    => ['required', 'in:family,staff,everyone,barangay'],
            'location_id' => ['nullable', 'exists:locations,id', 'required_if:audience,barangay'],
        ]);

        $data['sent_by']     = $request->user()?->id;
        $data['location_id'] = $data['audience'] === 'barangay' ? ($data['location_id'] ?? null) : null;

        Announcement::create($data);

        return redirect()->back()->with('success', 'Announcement sent successfully.');
    }
}