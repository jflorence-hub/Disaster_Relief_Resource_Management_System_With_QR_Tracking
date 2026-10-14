<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Issue a new API token for the mobile app after verifying credentials.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if (! Auth::once($credentials)) {
            return response()->json([
                'message' => 'The provided credentials do not match our records.',
            ], 401);
        }

        $user = Auth::user();

        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'This account is not active. Contact an administrator.',
            ], 403);
        }

        $plainToken = Str::random(64);
        $user->forceFill(['api_token' => hash('sha256', $plainToken)])->save();

        return response()->json([
            'token' => $plainToken,
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userPayload($request->user()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->forceFill(['api_token' => null])->save();

        return response()->json(['message' => 'Logged out.']);
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'                  => 'required|string|max:255',
            'email'                 => 'required|email|unique:users,email',
            'phone'                 => 'nullable|string|max:20',
            'password'              => 'required|string|min:8|confirmed',
        ]);

        User::create([
            'name'     => $validated['name'],
            'email'    => $validated['email'],
            'phone'    => $validated['phone'] ?? null,
            'password' => $validated['password'],
            'role'     => 'staff',
            'status'   => 'pending',
        ]);

        return response()->json([
            'message' => 'Registration successful. Wait for an administrator to activate your account.',
        ], 201);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        if (! $user) {
            // Return success even if user not found to avoid enumeration
            return response()->json(['message' => 'If that email is registered, an OTP has been sent.']);
        }

        $otp    = (string) random_int(100000, 999999);
        $expiry = Carbon::now()->addMinutes(10);

        $user->forceFill([
            'reset_code_hash'       => Hash::make($otp),
            'reset_code_expires_at' => $expiry,
        ])->save();

        Mail::raw("Your OTP for password reset is: {$otp}\n\nThis code expires in 10 minutes.", function ($message) use ($user) {
            $message->to($user->email)->subject('Password Reset OTP');
        });

        return response()->json(['message' => 'If that email is registered, an OTP has been sent.']);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'otp'   => 'required|digits:6',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! $user->reset_code_hash || ! $user->reset_code_expires_at) {
            return response()->json(['message' => 'Invalid or expired OTP.'], 422);
        }

        if (Carbon::now()->isAfter($user->reset_code_expires_at)) {
            return response()->json(['message' => 'Invalid or expired OTP.'], 422);
        }

        if (! Hash::check($request->otp, $user->reset_code_hash)) {
            return response()->json(['message' => 'Invalid or expired OTP.'], 422);
        }

        // Invalidate the OTP after successful verification
        $user->forceFill([
            'reset_code_hash'       => null,
            'reset_code_expires_at' => null,
        ])->save();

        return response()->json(['message' => 'OTP verified successfully.']);
    }

    private function userPayload($user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'status' => $user->status,
            'location_id' => $user->location_id,
            'purok_id' => $user->purok_id,
        ];
    }
}
