<?php

namespace App\Http\Controllers;

use App\Models\StaffMessage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StaffMessageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $admin = User::where('role', 'admin')->orderBy('id')->first();
        $messages = StaffMessage::query()
            ->where(fn ($q) => $q->where('sender_id', $user->id)->orWhere('recipient_id', $user->id))
            ->with(['sender:id,name,role', 'recipient:id,name,role'])
            ->orderBy('created_at')->get();
        if ($user->role === 'admin') {
            $staff = User::where('role', 'staff')->orderBy('name')->get(['id','name','role']);
        } else {
            $staff = collect();
            StaffMessage::where('recipient_id', $user->id)->whereNull('read_at')->update(['read_at' => now()]);
        }
        $familyMessages = collect();
        $families = collect();
        if ($user->role === 'staff' && Schema::hasColumn('family_messages', 'staff_id')) {
            $familyMessages = DB::table('family_messages')
                ->join('families', 'families.id', '=', 'family_messages.family_id')
                ->where('family_messages.staff_id', $user->id)
                ->select('family_messages.*', 'families.family_id as public_family_id', 'families.head_name')
                ->orderBy('family_messages.created_at')
                ->get();
            DB::table('family_messages')
                ->where('staff_id', $user->id)
                ->where('sender_type', 'family')
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
            $families = $familyMessages
                ->unique('family_id')
                ->map(fn ($message) => [
                    'id' => $message->family_id,
                    'family_id' => $message->public_family_id,
                    'head_name' => $message->head_name,
                ])
                ->values();
        }
        return Inertia::render('messages', ['messages' => $messages, 'staff' => $staff, 'admin' => $admin ? ['id' => $admin->id, 'name' => $admin->name] : null, 'userRole' => $user->role, 'familyMessages' => $familyMessages, 'families' => $families]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate(['message' => 'required|string|max:5000', 'staff_id' => 'nullable|exists:users,id', 'family_id' => 'nullable|exists:families,id']);

        if (! empty($data['family_id'])) {
            abort_unless($user->role === 'staff', 403, 'Only staff can reply to family messages.');
            abort_unless(Schema::hasColumn('family_messages', 'staff_id'), 500, 'Family message routing is not set up. Run migrations first.');
            $family = \App\Models\Family::findOrFail($data['family_id']);
            abort_unless((int) $family->purok?->assigned_staff_id === (int) $user->id, 403, 'This family is not assigned to your Purok.');
            DB::table('family_messages')->insert([
                'family_id' => $family->id,
                'staff_id' => $user->id,
                'admin_id' => null,
                'sender_type' => 'admin',
                'message' => $data['message'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            return back()->with('success', 'Reply sent to family.');
        }

        if ($user->role === 'admin') {
            abort_unless(!empty($data['staff_id']), 422, 'Select a staff member or a family.');
            $recipient = User::where('role', 'staff')->findOrFail($data['staff_id']);
        } elseif ($user->role === 'staff') {
            $recipient = User::where('role', 'admin')->orderBy('id')->firstOrFail();
        } else {
            abort(403, 'Only staff can message an administrator.');
        }
        StaffMessage::create(['sender_id' => $user->id, 'recipient_id' => $recipient->id, 'message' => $data['message']]);
        return back()->with('success', 'Message sent.');
    }
}
