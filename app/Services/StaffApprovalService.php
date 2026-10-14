<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class StaffApprovalService
{
    /**
     * Approve a pending staff registration.
     * Activates the account and notifies the staff member.
     */
    public function approve(User $user): void
    {
        if ($user->status !== 'pending') {
            throw new \InvalidArgumentException('User is not pending approval.');
        }

        // Load the purok and location the staff selected during registration
        $user->loadMissing(['purok:id,name', 'location:id,name']);
        $purokName    = $user->purok?->name    ?? 'your assigned purok';
        $locationName = $user->location?->name ?? 'your assigned location';

        $user->forceFill([
            'status'               => 'active',
            'must_change_password' => false,
        ])->save();

        try {
            Mail::raw(
                "Dear {$user->name},\n\n"
                . "Your staff registration request for the Disaster Relief Resource Management System "
                . "has been approved!\n\n"
                . "Your assignment:\n"
                . "  Location: {$locationName}\n"
                . "  Purok:    {$purokName}\n\n"
                . "You can log in using the email and password you registered with.\n\n"
                . "Welcome to the team!",
                function ($message) use ($user) {
                    $message->to($user->email)
                        ->subject('Registration Approved — Disaster Relief System');
                }
            );
        } catch (\Exception $e) {
            Log::error("Failed to send approval email to {$user->email}: {$e->getMessage()}");
        }
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

        $newStaff->loadMissing(['purok:id,name', 'location:id,name']);
        $purokName    = $newStaff->purok?->name ?? 'N/A';
        $locationName = $newStaff->location?->name ?? 'N/A';

        foreach ($admins as $admin) {
            try {
                Mail::raw(
                    "A new staff registration request has been submitted.\n\n"
                    . "Name:     {$newStaff->name}\n"
                    . "Email:    {$newStaff->email}\n"
                    . "Phone:    " . ($newStaff->phone ?? 'N/A') . "\n"
                    . "Location: {$locationName}\n"
                    . "Purok:    {$purokName}\n\n"
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
