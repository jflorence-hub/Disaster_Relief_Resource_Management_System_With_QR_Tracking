<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class StaffApprovalService
{
    /**
     * Approve a pending staff registration.
     * Returns the plain temporary password.
     */
    public function approve(User $user): string
    {
        if ($user->status !== 'pending') {
            throw new \InvalidArgumentException('User is not pending approval.');
        }

        $tempPassword = Str::random(8);
        $user->forceFill([
            'status' => 'active',
            'password' => $tempPassword, // cast will hash it
            'must_change_password' => true,
        ])->save();

        try {
            Mail::raw(
                "Congratulations {$user->name}, your registration has been approved.\n\n"
                . "Your temporary password is: {$tempPassword}\n\n"
                . "Please log in and change your password immediately.",
                function ($message) use ($user) {
                    $message->to($user->email)
                        ->subject('Staff Registration Approved — Disaster Relief System');
                }
            );
        } catch (\Exception $e) {
            Log::error("Failed to send approval email to {$user->email}: {$e->getMessage()}");
        }

        return $tempPassword;
    }

    /**
     * Reject a pending staff registration.
     * Sends email before deleting the user.
     */
    public function reject(User $user): void
    {
        if ($user->status !== 'pending') {
            throw new \InvalidArgumentException('User is not pending approval.');
        }

        $email = $user->email;
        $name = $user->name;

        try {
            Mail::raw(
                "Dear {$name},\n\n"
                . "We regret to inform you that your registration request was not approved. "
                . "Please contact the administrator for more information.",
                function ($message) use ($email) {
                    $message->to($email)
                        ->subject('Staff Registration Update — Disaster Relief System');
                }
            );
        } catch (\Exception $e) {
            Log::error("Failed to send rejection email to {$email}: {$e->getMessage()}");
        }

        $user->delete();
    }

    /**
     * Send new registration notification to all active admins.
     */
    public function notifyAdmins(User $newStaff): void
    {
        $admins = User::where('role', 'admin')
            ->where('status', 'active')
            ->get();

        if ($admins->isEmpty()) {
            Log::warning("No active admins found to notify about staff registration: {$newStaff->email}");
            return;
        }

        $purokName = $newStaff->purok?->name ?? 'N/A';

        foreach ($admins as $admin) {
            try {
                Mail::raw(
                    "A new staff registration request has been submitted.\n\n"
                    . "Name:  {$newStaff->name}\n"
                    . "Email: {$newStaff->email}\n"
                    . "Phone: " . ($newStaff->phone ?? 'N/A') . "\n"
                    . "Purok: {$purokName}\n\n"
                    . "Please log in to the admin panel to approve or reject this request.",
                    function ($message) use ($admin) {
                        $message->to($admin->email)->subject('New Staff Registration Request');
                    }
                );
            } catch (\Exception $e) {
                Log::error("Failed to send registration notification to admin {$admin->email}: {$e->getMessage()}");
            }
        }
    }
}
