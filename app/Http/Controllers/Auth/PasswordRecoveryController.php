<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Inertia\Inertia;
use Inertia\Response;

class PasswordRecoveryController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('forgot-password');
    }

    public function sendOtp(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $data['email'])
            ->where('role', 'admin')
            ->first();

        if (!$user) {
            return back()->withErrors([
                'email' => 'No administrator account was found for this email address.',
            ]);
        }

        $otp = (string) random_int(100000, 999999);

        Cache::put(
            'password_recovery:' . $user->email,
            Hash::make($otp),
            now()->addMinutes(10)
        );

        Cache::put(
            'password_recovery_verified:' . $user->email,
            false,
            now()->addMinutes(10)
        );

        try {
            Mail::raw(
                "Your Disaster Relief password recovery OTP is: {$otp}\n\n" .
                "It expires in 10 minutes. If you did not request this, ignore this email.",
                function ($message) use ($user) {
                    $message->to($user->email)
                        ->subject('Password Recovery OTP');
                }
            );
        } catch (TransportExceptionInterface $e) {
            Cache::forget('password_recovery:' . $user->email);
            Cache::forget('password_recovery_verified:' . $user->email);

            return back()->withErrors([
                'email' => 'The recovery email could not be sent. Check the mail settings and try again.',
            ]);
        }

        return back()->with(
            'status',
            'A 6-digit OTP was sent to your email. It expires in 10 minutes.'
        );
    }

    public function verifyOtp(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => 'required|email',
            'otp' => 'required|digits:6',
        ]);

        abort_unless(
            User::where('email', $data['email'])->where('role', 'admin')->exists(),
            404
        );

        $stored = Cache::get(
            'password_recovery:' . $data['email']
        );

        if (!$stored || !Hash::check($data['otp'], $stored)) {
            return back()->withErrors([
                'otp' => 'The OTP is invalid or expired.',
            ]);
        }

        Cache::put(
            'password_recovery_verified:' . $data['email'],
            true,
            now()->addMinutes(10)
        );

        return back()
            ->with('otp_verified', true)
            ->with('status', 'OTP verified. You can now set a new password.');
    }

    public function resetPassword(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if (!Cache::get(
            'password_recovery_verified:' . $data['email']
        )) {
            return back()->withErrors([
                'otp' => 'Verify your OTP before changing the password.',
            ]);
        }

        $user = User::where('email', $data['email'])
            ->where('role', 'admin')
            ->firstOrFail();

        $user->password = Hash::make($data['password']);
        $user->must_change_password = false;
        $user->save();

        Cache::forget('password_recovery:' . $data['email']);
        Cache::forget('password_recovery_verified:' . $data['email']);

        return redirect()->route('login')->with(
            'status',
            'Password changed successfully. Please log in with your new password.'
        );
    }
}