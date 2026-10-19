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
     * Supports audience: everyone, staff, family. location_id is an optional barangay scope.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title'       => ['required', 'string', 'max:255'],
            'body'        => ['required', 'string'],
            'audience'    => ['required', 'in:family,staff,everyone'],
            'location_id' => ['nullable', 'exists:locations,id'],
        ]);

        $data['sent_by'] = $request->user()?->id;

        Announcement::create($data);

        return redirect()->back()->with('success', 'Announcement sent successfully.');
    }

    public function destroy(Announcement $announcement): RedirectResponse
    {
        $announcement->delete();

        return redirect()->back()->with('success', 'Announcement deleted successfully.');
    }
}