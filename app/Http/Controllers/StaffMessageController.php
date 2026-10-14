<?php

namespace App\Http\Controllers;

use App\Models\StaffMessage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
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
        $familyMessages = $user->role === 'admin'
            ? DB::table('family_messages')->join('families', 'families.id', '=', 'family_messages.family_id')->select('family_messages.*', 'families.family_id as public_family_id', 'families.family_name', 'families.head_name')->orderBy('family_messages.created_at')->get()
            : collect();
        $families = $user->role === 'admin' ? \App\Models\Family::orderBy('family_name')->get(['id', 'family_id', 'family_name']) : collect();
        return Inertia::render('messages', ['messages' => $messages, 'staff' => $staff, 'admin' => $admin ? ['id' => $admin->id, 'name' => $admin->name] : null, 'userRole' => $user->role, 'familyMessages' => $familyMessages, 'families' => $families]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate(['message' => 'required|string|max:5000', 'staff_id' => 'nullable|exists:users,id', 'family_id' => 'nullable|exists:families,id']);
        if ($user->role === 'admin' && !empty($data['family_id'])) {
            abort_unless(\Illuminate\Support\Facades\Schema::hasTable('family_messages'), 500, 'Family messages are not set up. Run migrations first.');
            $family = \App\Models\Family::findOrFail($data['family_id']);
            DB::table('family_messages')->insert(['family_id' => $family->id, 'admin_id' => $user->id, 'sender_type' => 'admin', 'message' => $data['message'], 'created_at' => now(), 'updated_at' => now()]);
            return back()->with('success', 'Reply sent to family.');
        }
        if ($user->role === 'admin') {
            abort_unless(!empty($data['staff_id']), 422, 'Select a staff member or a family.');
            $recipient = User::where('role', 'staff')->findOrFail($data['staff_id']);
        } else {
            $recipient = User::where('role', 'admin')->orderBy('id')->firstOrFail();
        }
        StaffMessage::create(['sender_id' => $user->id, 'recipient_id' => $recipient->id, 'message' => $data['message']]);
        return back()->with('success', 'Message sent.');
    }
}
