<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;

class FamilyAuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'family_name'    => 'required|string|max:255',
            'head_name'      => 'required|string|max:255',
            'email'          => 'required|email|max:255|unique:families,email',
            'phone'          => 'required|string|max:50|regex:/^09[0-9]{9}$/|unique:families,phone',
            'address'        => 'required|string|max:2000',
            'household_member' => 'required|integer|min:1|max:100',
            'purok_id'       => 'required|exists:puroks,id',
            'location_id'    => 'required|exists:locations,id',
            'pin'            => ['required', 'string', 'regex:/^[0-9]{4,6}$/'],
            'member_names'   => 'required|array|min:1',
            'member_names.*' => 'required|string|max:255',
        ]);

        // Check head_name against existing Family heads (case-insensitive).
        if (\App\Models\Family::whereRaw('LOWER(TRIM(head_name)) = ?', [strtolower(trim($data['head_name']))])->exists()) {
            return response()->json(['message' => "A family headed by \"{$data['head_name']}\" is already registered."], 422);
        }

        // Check head_name against existing HouseholdMember names (case-insensitive).
        if (\App\Models\HouseholdMember::whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($data['head_name']))])->exists()) {
            return response()->json(['message' => "\"{$data['head_name']}\" is already a registered household member in another family."], 422);
        }

        // Check each member name against Family heads and HouseholdMember names (case-insensitive).
        foreach ($data['member_names'] as $name) {
            if (!$name || trim($name) === '') continue;

            if (\App\Models\Family::whereRaw('LOWER(TRIM(head_name)) = ?', [strtolower(trim($name))])->exists()) {
                return response()->json(['message' => "\"{$name}\" is already a head of family in a registered account."], 422);
            }

            if (\App\Models\HouseholdMember::whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($name))])->exists()) {
                return response()->json(['message' => "\"{$name}\" is already listed as a household member in another family. Each person belongs to one family only."], 422);
            }
        }

        $data['email'] = strtolower(trim($data['email']));
        $maxId = (int) (Family::max('id') ?? 0);
        $familyId = 'FAM-' . str_pad((string) ($maxId + 1), 4, '0', STR_PAD_LEFT);
        while (Family::where('family_id', $familyId)->exists()) {
            $maxId++;
            $familyId = 'FAM-' . str_pad((string) $maxId, 4, '0', STR_PAD_LEFT);
        }

        $family = Family::create([
            'family_name'      => $data['family_name'],
            'head_name'        => $data['head_name'],
            'email'            => $data['email'],
            'phone'            => $data['phone'],
            'address'          => $data['address'],
            'household_member' => count($data['member_names']),
            'purok_id'         => $data['purok_id'],
            'location_id'      => $data['location_id'],
            'family_id'        => $familyId,
            'pin'              => Hash::make($data['pin']),
            'status'           => 'active',
        ]);

        // Create HouseholdMember records with names.
        foreach ($data['member_names'] as $index => $name) {
            $family->household_member()->create([
                'household_member_number' => $index + 1,
                'name'                    => trim($name),
            ]);
        }

        return response()->json([
            'message' => 'Family registered successfully. Please sign in.',
            'family'  => $this->payload($family->load(['location:id,name', 'purok:id,name'])),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'family_id' => 'nullable|string|max:255',
            'pin' => 'required|string',
        ]);
        $identifier = trim((string) ($data['phone'] ?? $data['identifier'] ?? $data['family_id'] ?? ''));
        if ($identifier === '') {
            return response()->json(['message' => 'Enter your registered phone number or Family ID.'], 422);
        }
        $family = Family::with(['location:id,name', 'purok:id,name'])
            ->where(fn ($q) => $q->where('phone', $identifier)->orWhere('family_id', $identifier))
            ->first();

        if (!$family || !Hash::check($data['pin'], $family->pin)) {
            return response()->json(['message' => 'Invalid phone number / Family ID or PIN.'], 401);
        }
        if ($family->status !== 'active') {
            return response()->json(['message' => 'This family account is not active. Please contact the administrator.'], 403);
        }
        $token = Str::random(64);
        $family->forceFill(['api_token' => hash('sha256', $token)])->save();
        return response()->json(['token' => $token, 'family' => $this->payload($family)]);
    }

    public function me(Request $request): JsonResponse
    {
        $family = $request->user()->load(['location:id,name', 'purok:id,name']);
        $members = $family->household_member()
            ->orderBy('household_member_number')
            ->get(['id', 'household_member_number', 'name'])
            ->map(fn ($m) => [
                'id'     => $m->id,
                'number' => $m->household_member_number,
                'name'   => $m->display_name,
            ]);
        return response()->json([
            'family'            => $this->payload($family),
            'household_members' => $members,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->forceFill(['api_token' => null])->save();
        return response()->json(['message' => 'Logged out.']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email']);
        $family = Family::where('email', strtolower(trim($data['email'])))->first();
        // Do not disclose whether an email is registered.
        if (!$family) return response()->json(['message' => 'If this email belongs to an active family account, a reset code has been sent.']);
        $code = (string) random_int(100000, 999999);
        $family->forceFill([
            'reset_code_hash' => Hash::make($code),
            'reset_code_expires_at' => Carbon::now()->addMinutes(10),
        ])->save();
        Mail::raw("Your Barangay Household Portal PIN reset code is: {$code}\nThis code expires in 10 minutes. If you did not request this, ignore this email.", function ($message) use ($family) {
            $message->to($family->email)->subject('Family PIN reset code');
        });
        return response()->json(['message' => 'If this email belongs to an active family account, a reset code has been sent.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email', 'otp' => 'required|digits:6',
            'password' => ['required', 'string', 'regex:/^[0-9]{4,6}$/', 'confirmed'],
        ]);
        $family = Family::where('email', strtolower(trim($data['email'])))->first();
        if (!$family || !$family->reset_code_hash || !$family->reset_code_expires_at || Carbon::parse($family->reset_code_expires_at)->isPast() || !Hash::check($data['otp'], $family->reset_code_hash)) {
            return response()->json(['message' => 'The reset code is invalid or expired. Request a new code.'], 422);
        }
        $family->forceFill([
            'pin' => Hash::make($data['password']), 'api_token' => null,
            'reset_code_hash' => null, 'reset_code_expires_at' => null,
        ])->save();
        return response()->json(['message' => 'PIN changed successfully. Please log in again.']);
    }

    private function payload(Family $family): array
    {
        return [
            'id' => $family->id, 'family_id' => $family->family_id,
            'family_name' => $family->family_name, 'head_name' => $family->head_name,
            'phone' => $family->phone, 'email' => $family->email,
            'household_member' => $family->household_member, 'address' => $family->address,
            'purok_id' => $family->purok_id, 'location_id' => $family->location_id,
            'purok' => $family->purok ? ['id' => $family->purok->id, 'name' => $family->purok->name] : null,
            'location' => $family->location ? ['id' => $family->location->id, 'name' => $family->location->name] : null,
            'status' => $family->status,
        ];
    }
}
