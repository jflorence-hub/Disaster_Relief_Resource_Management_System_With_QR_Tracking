<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\StaffMessage;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CommunicationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $announcements = Announcement::with('author:id,name')
            ->where('is_published', true)
            ->latest()
            ->limit(50)
            ->get();

        $messages = StaffMessage::with([
            'sender:id,name,role',
            'recipient:id,name,role',
        ])
            ->where(function ($query) use ($user) {
                $query->where('sender_id', $user->id)
                    ->orWhere('recipient_id', $user->id);
            })
            ->latest()
            ->limit(100)
            ->get()
            ->sortBy('created_at')
            ->values();

        $admins = User::where('role', 'admin')
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('communications', [
            'announcements' => $announcements,
            'messages' => $messages,
            'admins' => $admins,
            'isAdmin' => $user->role === 'admin',
        ]);
    }

    public function announce(Request $request): RedirectResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $data = $request->validate([
            'title' => 'required|string|max:180',
            'body' => 'required|string|max:5000',
        ]);

        Announcement::create([
            'created_by' => $request->user()->id,
            'title' => $data['title'],
            'body' => $data['body'],
            'is_published' => true,
        ]);

        return back()->with(
            'success',
            'Announcement published for staff.'
        );
    }

    public function message(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        $admin = User::where('role', 'admin')
            ->where('status', 'active')
            ->orderBy('id')
            ->first();

        if (!$admin) {
            return back()->with(
                'error',
                'No active administrator is available to receive messages.'
            );
        }

        StaffMessage::create([
            'sender_id' => $request->user()->id,
            'recipient_id' => $request->user()->role === 'admin'
                ? User::where('role', 'staff')
                    ->where('status', 'active')
                    ->orderBy('id')
                    ->value('id')
                : $admin->id,
            'body' => $data['body'],
        ]);

        return back()->with('success', 'Message sent.');
    }
}