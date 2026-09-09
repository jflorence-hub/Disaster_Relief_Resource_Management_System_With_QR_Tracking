<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(Request $request): Response
    {
        $members = User::query()
            ->with('location:id,name')
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

        return Inertia::render('team-management', [
            'members' => $members,
            'locations' => Location::select('id', 'name')->orderBy('name')->get(),
            'filters' => $request->only(['search', 'role', 'status']),
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
}
