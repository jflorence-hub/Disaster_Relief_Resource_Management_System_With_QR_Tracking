<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Purok;

class TeamController extends Controller
{
    public function index(Request $request): Response
    {
        $members = User::query()
            ->with('location:id,name')
            ->where('status', '!=', 'pending')
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($request->string('role')->toString(), fn ($query, $role) => $query->where('role', $role))
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->orderBy('name')
            ->get();

        $pendingStaff = User::where('status', 'pending')
            ->where('role', 'staff')
            ->with('purok:id,name')
            ->orderBy('created_at')
            ->get(['id', 'name', 'email', 'phone', 'purok_id', 'created_at']);

        return Inertia::render('team-management', [
            'members' => $members,
            'pendingStaff' => $pendingStaff,
            'locations' => Location::select('id', 'name')->orderBy('name')->get(),
            'filters' => $request->only(['search', 'role', 'status']),
            'puroks' => Purok::select('id', 'name', 'code')
                     ->where('status', 'active')
                     ->orderBy('name')
                     ->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|in:admin,staff',
            'phone' => 'nullable|string|max:50',
            'status' => 'required|in:active,on_leave,inactive',
            'location_id' => 'nullable|exists:locations,id',
            'responsibilities' => 'nullable|string|max:255',
            'purok_id' => 'nullable|exists:puroks,id',
        ]);

        $data['password'] = Hash::make($data['password']);

        User::create($data);

        return back()->with('success', 'Team member added successfully.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,'.$user->id,
            'password' => 'nullable|string|min:8',
            'role' => 'required|in:admin,staff',
            'phone' => 'nullable|string|max:50',
            'status' => 'required|in:active,on_leave,inactive',
            'location_id' => 'nullable|exists:locations,id',
            'responsibilities' => 'nullable|string|max:255',
            'purok_id' => 'nullable|exists:puroks,id',
        ]);

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $user->update($data);

        return back()->with('success', 'Team member updated successfully.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($request->user()->id === $user->id) {
            return back()->with('error', 'You cannot remove your own account.');
        }

        $user->delete();

        return back()->with('success', 'Team member removed successfully.');
    }

    public function approve(User $user): RedirectResponse
    {
        if ($user->status !== 'pending') {
            return back()->with('error', 'This user is not pending approval.');
        }

        $tempPassword = Str::random(8);
        $user->forceFill([
            'status' => 'active',
            'password' => Hash::make($tempPassword),
        ])->save();

        Mail::raw(
            "Congratulations {$user->name}, your registration has been approved. Your temporary password is: {$tempPassword}. Please log in and change your password immediately.",
            function ($message) use ($user) {
                $message->to($user->email)
                    ->subject('Staff Registration Approved — Disaster Relief System');
            }
        );

        return back()->with('success', 'Staff member approved and notified.');
    }

    public function reject(User $user): RedirectResponse
    {
        $name = $user->name;
        $email = $user->email;

        Mail::raw(
            'We regret to inform you that your registration request was not approved. Please contact the administrator for more information.',
            function ($message) use ($email, $name) {
                $message->to($email)
                    ->subject('Staff Registration Update — Disaster Relief System');
            }
        );

        $user->delete();

        return back()->with('success', 'Registration request rejected.');
    }
}
