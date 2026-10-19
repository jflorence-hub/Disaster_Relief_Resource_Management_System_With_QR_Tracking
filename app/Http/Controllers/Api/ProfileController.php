<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    /**
     * Update the authenticated staff member's profile.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name'  => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'phone' => ['nullable', 'regex:/^09[0-9]{9}$/'],
            'birthdate' => [
                'sometimes',
                'required',
                'date',
                'before_or_equal:' . now()->subYears(18)->toDateString(),
            ],
            'home_address' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $user->fill($data)->save();

        $user->loadMissing(['location:id,name', 'purok:id,name']);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user'    => $this->userPayload($user),
        ]);
    }

    /**
     * Upload and store a new avatar for the authenticated staff member.
     */
    public function uploadAvatar(Request $request): JsonResponse
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

        return response()->json([
            'message'    => 'Avatar updated successfully.',
            'avatar_url' => Storage::disk('public')->url($path),
        ]);
    }

    /**
     * Build the user payload for API responses.
     */
    private function userPayload($user): array
    {
        $user->loadMissing(['location:id,name', 'purok:id,name']);

        return [
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
            'birthdate'   => $user->birthdate?->toDateString(),
            'home_address' => $user->home_address,
            'location_id' => $user->location_id,
            'purok_id'    => $user->purok_id,
            'location'    => $user->location
                ? ['id' => $user->location->id, 'name' => $user->location->name]
                : null,
            'purok'       => $user->purok
                ? ['id' => $user->purok->id, 'name' => $user->purok->name]
                : null,
        ];
    }
}
