<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the profile page for the authenticated user.
     */
    public function show(Request $request): Response
    {
        $user = $request->user();
        $user->loadMissing(['location:id,name', 'purok:id,name']);

        return Inertia::render('profile', [
            'user' => [
                'id'          => $user->id,
                'name'        => $user->name,
                'email'       => $user->email,
                'phone'       => $user->phone,
                'role'        => $user->role,
                'status'      => $user->status,
                'avatar'      => $user->avatar,
                'avatar_url'  => $user->avatar
                    ? Storage::disk('public')->url($user->avatar)
                    : null,
                'location'    => $user->location
                    ? ['id' => $user->location->id, 'name' => $user->location->name]
                    : null,
                'purok'       => $user->purok
                    ? ['id' => $user->purok->id, 'name' => $user->purok->name]
                    : null,
            ],
        ]);
    }

    /**
     * Update the authenticated user's profile information.
     */
    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name'  => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'phone' => ['nullable', 'regex:/^09[0-9]{9}$/'],
        ]);

        $user->fill($data)->save();

        return redirect()->back()->with('success', 'Profile updated successfully.');
    }

    /**
     * Upload a new avatar for the authenticated user.
     */
    public function uploadAvatar(Request $request): RedirectResponse
    {
        $request->validate([
            'avatar' => ['required', 'image', 'max:2048'],
        ]);

        $user = $request->user();

        // Delete old avatar if present
        if ($user->avatar) {
            Storage::disk('public')->delete($user->avatar);
        }

        $path = $request->file('avatar')->store('avatars', 'public');

        $user->forceFill(['avatar' => $path])->save();

        return redirect()->back()->with('success', 'Profile picture updated successfully.');
    }
}
