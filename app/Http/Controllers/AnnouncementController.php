<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
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
        $announcements = Announcement::with('sender:id,name')
            ->orderByDesc('created_at')
            ->get();

        return Inertia::render('announcements', [
            'announcements' => $announcements,
        ]);
    }

    /**
     * Create a new announcement.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title'    => ['required', 'string', 'max:255'],
            'body'     => ['required', 'string'],
            'audience' => ['required', 'in:family,staff'],
        ]);

        $data['sent_by'] = $request->user()?->id;

        Announcement::create($data);

        return redirect()->back()->with('success', 'Announcement sent successfully.');
    }
}
