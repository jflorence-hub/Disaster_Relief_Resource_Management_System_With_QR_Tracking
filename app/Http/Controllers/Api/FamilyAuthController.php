<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class FamilyAuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'family_name' => 'required|string|max:255',
            'head_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'beneficiary_count' => 'required|integer|min:1',
            'purok_id' => 'required|exists:puroks,id',
            'location_id' => 'required|exists:locations,id',
            'pin' => 'required|string|min:4|max:20',
        ]);

        do {
            $familyId = 'FAM-' . strtoupper(Str::random(8));
        } while (Family::where('family_id', $familyId)->exists());

        $family = Family::create([
            ...$data,
            'family_id' => $familyId,
            'pin' => Hash::make($data['pin']),
            'status' => 'active',
        ]);

        return response()->json([
            'message' => 'Family registered successfully.',
            'family' => $this->payload($family->load('location:id,name')),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'family_id' => 'required|string',
            'pin' => 'required|string',
        ]);

        $family = Family::with('location:id,name')
            ->where('family_id', $data['family_id'])
            ->first();

        if (!$family || !Hash::check($data['pin'], $family->pin)) {
            return response()->json(['message' => 'Invalid Family ID or PIN.'], 401);
        }

        if ($family->status !== 'active') {
            return response()->json(['message' => 'This family account is not active.'], 403);
        }

        $token = Str::random(64);
        $family->forceFill(['api_token' => hash('sha256', $token)])->save();

        return response()->json([
            'token' => $token,
            'family' => $this->payload($family),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'family' => $this->payload($request->user()->load('location:id,name')),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->forceFill(['api_token' => null])->save();

        return response()->json(['message' => 'Logged out.']);
    }

    private function payload(Family $family): array
    {
        return [
            'id' => $family->id,
            'family_id' => $family->family_id,
            'family_name' => $family->family_name,
            'head_name' => $family->head_name,
            'phone' => $family->phone,
            'beneficiary_count' => $family->beneficiary_count,
            'address' => $family->address,
            'purok_id' => $family->purok_id,
            'location_id' => $family->location_id,
            'location' => $family->location ? [
                'id' => $family->location->id,
                'name' => $family->location->name,
            ] : null,
            'status' => $family->status,
        ];
    }
}
