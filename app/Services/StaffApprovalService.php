<?php

namespace App\Services;

use App\Models\Purok;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class StaffApprovalService
{
    /**
     * Approve a pending staff registration.
     * Activates the account, assigns the purok, and notifies the staff member.
     *
     * @param  int|null  $purokId  The purok to assign, or null for no assignment.
     */
    public function approve(User $user, ?int $purokId = null): void
    {
        if ($user->status !== 'pending') {
            throw new \InvalidArgumentException('User is not pending approval.');
        }

        DB::transaction(function () use ($user, $purokId) {
            if ($purokId !== null) {
                $purok = Purok::query()
                    ->whereKey($purokId)
                    ->where('location_id', $user->location_id)
                    ->where('status', 'active')
                    ->whereIn('name', array_map(fn ($number) => "Purok {$number}", range(1, 7)))
                    ->lockForUpdate()
                    ->first();

                if (! $purok || ($purok->assigned_staff_id !== null && (int) $purok->assigned_staff_id !== $user->id)) {
                    throw ValidationException::withMessages([
                        'purok_id' => 'Choose an available Purok from the staff member’s barangay.',
                    ]);
                }

                Purok::where('assigned_staff_id', $user->id)
                    ->update(['assigned_staff_id' => null]);
                $user->purok_id = $purok->id;
                $purok->update(['assigned_staff_id' => $user->id]);
            } else {
                Purok::where('assigned_staff_id', $user->id)
                    ->update(['assigned_staff_id' => null]);
                $user->purok_id = null;
            }

            $user->forceFill([
                'status'               => 'active',
                'must_change_password' => false,
            ])->save();
        });

        // Load the purok and location for the email
        $user->loadMissing(['purok:id,name', 'location:id,name']);
        $purokName    = $user->purok?->name    ?? 'your assigned purok';
        $locationName = $user->location?->name ?? 'your assigned location';

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
                        ->subject('Registration Approved - Disaster Relief System');
                }
            );
        } catch (\Exception $e) {
            Log::error("Failed to send approval email to {$user->email}: {$e->getMessage()}");
        }
    }

    /**
     * Reject a pending staff registration.
     * Sends the rejection email before deleting the user.
     *
     * The optional $reason (max 1000 chars, trimmed by the controller) is
     * injected into the email body when non-empty and recorded as a single
     * audit log line. No database column persists the reason.
     */
    public function reject(User $user, string $reason = ''): void
    {
        if ($user->status !== 'pending') {
            throw new \InvalidArgumentException('User is not pending approval.');
        }

        $email  = $user->email;
        $name   = $user->name;
        $reason = trim($reason); // defense-in-depth; controller already trims

        // Build body: keep the generic sentence in all cases; insert the
        // reason line only when a non-empty reason was provided.
        $body = "Dear {$name},\n\n"
            . "We regret to inform you that your registration request was not approved.";

        if ($reason !== '') {
            $body .= "\n\nReason provided: {$reason}";
        }

        $body .= "\n\nPlease contact the administrator for more information.";

        try {
            Mail::raw($body, function ($message) use ($email) {
                $message->to($email)
                    ->subject('Staff Registration Update - Disaster Relief System');
            });
        } catch (\Exception $e) {
            Log::error("Failed to send rejection email to {$email}: {$e->getMessage()}");
        }

        // Optional audit line — the only persisted record of the reason
        // (lives in Laravel logs, never in the database).
        if ($reason !== '') {
            Log::info("Staff registration rejected for {$email}. Reason: {$reason}");
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
