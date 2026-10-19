<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use App\Models\HouseholdMember;
use App\Models\Location;
use App\Models\Purok;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class FamilyAuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'head_name'      => 'required|string|max:255',
            'email'          => 'required|email|max:255|unique:families,email',
            'phone'          => 'required|string|max:50|regex:/^09[0-9]{9}$/|unique:families,phone',
            'household_member' => 'required|integer|min:1|max:100',
            'purok_id'       => 'required|exists:puroks,id',
            'location_id'    => 'required|exists:locations,id',
            'pin'            => ['required', 'string', 'regex:/^[0-9]{4,6}$/'],
            'member_names'   => 'required|array|min:1',
            'member_names.*' => 'required|string|max:255',
        ]);

        if (! Location::whereKey($data['location_id'])->where('status', 'active')->exists()) {
            return response()->json([
                'message' => 'The selected barangay is not active.',
                'errors' => ['location_id' => ['Select an active barangay.']],
            ], 422);
        }

        if (! Purok::whereKey($data['purok_id'])
            ->where('location_id', $data['location_id'])
            ->where('status', 'active')
            ->exists()) {
            return response()->json([
                'message' => 'The selected purok does not belong to the selected barangay.',
                'errors' => ['purok_id' => ['Select a purok in the selected barangay.']],
            ], 422);
        }

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
        $family = Family::create([
            'head_name'        => $data['head_name'],
            'email'            => $data['email'],
            'phone'            => $data['phone'],
            'household_member' => count($data['member_names']),
            'purok_id'         => $data['purok_id'],
            'location_id'      => $data['location_id'],
            'pin'              => Hash::make($data['pin']),
            'status'           => 'pending',
        ]);

        // Create HouseholdMember records with names.
        foreach ($data['member_names'] as $index => $name) {
            $family->household_member()->create([
                'household_member_number' => $index + 1,
                'name'                    => trim($name),
            ]);
        }

        return response()->json([
            'message' => 'Registration submitted for review. You will receive an email when your account is approved.',
            'family'  => $this->payload($family->load(['location:id,name', 'purok:id,name'])),
        ], 201);
    }

    public function registerMember(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'head_name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => ['required', 'string', 'regex:/^09[0-9]{9}$/'],
            'password' => 'required|string|min:8|max:255',
        ]);

        $email = strtolower(trim($data['email']));
        $phone = trim($data['phone']);
        $name = trim($data['name']);
        $headName = trim($data['head_name']);

        $families = Family::query()
            ->whereRaw('LOWER(TRIM(head_name)) = ?', [strtolower($headName)])
            ->limit(2)
            ->get();

        if ($families->isEmpty()) {
            return response()->json([
                'message' => 'No registered family matches that Head of the Family name.',
            ], 422);
        }
        if ($families->count() > 1) {
            return response()->json([
                'message' => 'More than one family matches that name. Contact the administrator to verify the family record.',
            ], 422);
        }
        $family = $families->first();

        if ($family->status !== 'active') {
            return response()->json([
                'message' => 'This family account is not active. Contact the administrator.',
            ], 422);
        }

        $members = HouseholdMember::query()
            ->where('family_id', $family->id)
            ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower($name)])
            ->limit(2)
            ->get();

        if ($members->isEmpty()) {
            return response()->json([
                'message' => 'The member name must exactly match a household member record under that family.',
            ], 422);
        }
        if ($members->count() > 1) {
            return response()->json([
                'message' => 'More than one household member matches that name. Contact the administrator to verify the member record.',
            ], 422);
        }
        $member = $members->first();

        $emailInUse = Family::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->exists() || HouseholdMember::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('id', '!=', $member->id)
            ->exists();

        $phoneInUse = Family::query()
            ->where('phone', $phone)
            ->exists() || HouseholdMember::query()
            ->where('phone', $phone)
            ->where('id', '!=', $member->id)
            ->exists();

        if ($emailInUse || $phoneInUse) {
            return response()->json([
                'message' => $emailInUse
                    ? 'That email is already used by another account.'
                    : 'That phone number is already used by another account.',
            ], 422);
        }

        if ($member->email || $member->phone || $member->password) {
            return response()->json([
                'message' => 'This household member already has an account.',
            ], 422);
        }

        DB::transaction(function () use ($member, $email, $phone, $data) {
            $member->forceFill([
                'email' => $email,
                'phone' => $phone,
                'password' => Hash::make($data['password']),
            ])->save();
        });

        return response()->json([
            'message' => 'Member account created. Sign in with the registered email or phone and password.',
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'pin' => 'required|string',
        ]);
        $identifier = trim((string) ($data['identifier'] ?? $data['email'] ?? $data['phone'] ?? ''));
        if ($identifier === '') {
            return response()->json(['message' => 'Enter your registered email or phone number.'], 422);
        }
        $family = Family::with(['location:id,name', 'purok:id,name'])
            ->where(fn ($q) => $q
                ->where('phone', $identifier)
                ->orWhereRaw('LOWER(email) = ?', [strtolower($identifier)]))
            ->first();

        $member = null;
        if ($family) {
            if (! Hash::check($data['pin'], $family->pin)) {
                return response()->json(['message' => 'Invalid email / phone number or PIN.'], 401);
            }
        } else {
            $member = HouseholdMember::with('family.location:id,name', 'family.purok:id,name')
                ->where(fn ($q) => $q
                    ->where('phone', $identifier)
                    ->orWhereRaw('LOWER(email) = ?', [strtolower($identifier)]))
                ->first();

            if (! $member || ! $member->family || ! $member->password || ! Hash::check($data['pin'], $member->password)) {
                return response()->json(['message' => 'Invalid email / phone number or password.'], 401);
            }
            $family = $member->family;
        }

        if ($family->status !== 'active') {
            return response()->json(['message' => 'This family account is not active. Please contact the administrator.'], 403);
        }
        $token = Str::random(64);
        if ($member) {
            $member->forceFill(['api_token' => hash('sha256', $token)])->save();
        } else {
            $family->forceFill(['api_token' => hash('sha256', $token)])->save();
        }
        return response()->json([
            'token'           => $token,
            'family'          => $this->payload($family),
            'must_change_pin' => $member ? false : (bool) $family->must_change_pin,
            'authenticated_member' => $member ? [
                'id' => $member->id,
                'name' => $member->display_name,
            ] : null,
        ]);
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
            'authenticated_member' => $request->attributes->get('authenticated_household_member')
                ? [
                    'id' => $request->attributes->get('authenticated_household_member')->id,
                    'name' => $request->attributes->get('authenticated_household_member')->display_name,
                ]
                : null,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $member = $request->attributes->get('authenticated_household_member');
        if ($member) {
            $member->forceFill(['api_token' => null])->save();
        } else {
            $request->user()->forceFill(['api_token' => null])->save();
        }
        return response()->json(['message' => 'Logged out.']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email']);
        $family = Family::whereRaw('LOWER(email) = ?', [strtolower(trim($data['email']))])->first();
        // Do not disclose whether an email is registered.
        if (!$family) return response()->json(['message' => 'If this email belongs to an active family account, a reset code has been sent.']);
        $code = (string) random_int(100000, 999999);
        $family->forceFill([
            'reset_code_hash' => Hash::make($code),
            'reset_code_expires_at' => Carbon::now()->addMinutes(10),
        ])->save();
        try {
            Mail::raw("Your Barangay Household Portal PIN reset code is: {$code}\nThis code expires in 10 minutes. If you did not request this, ignore this email.", function ($message) use ($family) {
                $message->to($family->email)->subject('Family PIN reset code');
            });
        } catch (TransportExceptionInterface $e) {
            $family->forceFill([
                'reset_code_hash' => null,
                'reset_code_expires_at' => null,
            ])->save();
            Log::error('Family PIN recovery email could not be sent.', [
                'family_id' => $family->id,
                'exception' => $e,
            ]);

            return response()->json([
                'message' => 'The recovery email could not be sent. Try again later.',
            ], 503);
        }
        return response()->json(['message' => 'If this email belongs to an active family account, a reset code has been sent.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email', 'otp' => 'required|digits:6',
            'password' => ['required', 'string', 'regex:/^[0-9]{4,6}$/', 'confirmed'],
        ]);
        $family = Family::whereRaw('LOWER(email) = ?', [strtolower(trim($data['email']))])->first();
        if (!$family || !$family->reset_code_hash || !$family->reset_code_expires_at || Carbon::parse($family->reset_code_expires_at)->isPast() || !Hash::check($data['otp'], $family->reset_code_hash)) {
            return response()->json(['message' => 'The reset code is invalid or expired. Request a new code.'], 422);
        }
        $family->forceFill([
            'pin' => Hash::make($data['password']), 'api_token' => null,
            'reset_code_hash' => null, 'reset_code_expires_at' => null,
            'must_change_pin' => false,
        ])->save();
        $this->supersedePendingTemporaryPin($family);
        return response()->json(['message' => 'PIN changed successfully. Please log in again.']);
    }

    /**
     * Change PIN while logged in (used after bulk import sets must_change_pin = true).
     * Requires the current PIN for verification, then sets the new PIN and clears the flag.
     */
    public function changePin(Request $request): JsonResponse
    {
        abort_if(
            $request->attributes->get('authenticated_household_member'),
            403,
            'A household member cannot change the family head PIN.'
        );

        $data = $request->validate([
            'current_pin' => ['required', 'string'],
            'new_pin'     => ['required', 'string', 'regex:/^[0-9]{4,6}$/', 'different:current_pin'],
        ], [
            'new_pin.regex'    => 'PIN must be 4–6 digits.',
            'new_pin.different' => 'New PIN must be different from the current PIN.',
        ]);

        $family = $request->user();

        if (! Hash::check($data['current_pin'], $family->pin)) {
            return response()->json(['message' => 'Current PIN is incorrect.'], 422);
        }

        $family->forceFill([
            'pin'             => Hash::make($data['new_pin']),
            'must_change_pin' => false,
        ])->save();
        $this->supersedePendingTemporaryPin($family);

        return response()->json(['message' => 'PIN changed successfully.']);
    }

    private function supersedePendingTemporaryPin(Family $family): void
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('family_credential_deliveries')) {
            return;
        }

        DB::table('family_credential_deliveries')
            ->where('family_id', $family->id)
            ->whereNotIn('status', ['sent', 'delivered', 'superseded'])
            ->update([
                'status' => 'superseded',
                'pin_encrypted' => null,
                'last_error' => null,
                'updated_at' => now(),
            ]);
    }

    private function payload(Family $family): array
    {
        return [
            'id' => $family->id, 'family_id' => $family->family_id,
            'qr_code' => $family->qr_code,
            'head_name' => $family->head_name,
            'phone' => $family->phone, 'email' => $family->email,
            'household_member' => $family->household_member,
            'purok_id' => $family->purok_id, 'location_id' => $family->location_id,
            'purok' => $family->purok ? ['id' => $family->purok->id, 'name' => $family->purok->name] : null,
            'location' => $family->location ? ['id' => $family->location->id, 'name' => $family->location->name] : null,
            'status' => $family->status,
        ];
    }
}
