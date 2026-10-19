<?php

namespace App\Services;

use App\Models\Family;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class FamilyApprovalService
{
    public function approve(Family $family): bool
    {
        DB::transaction(function () use ($family) {
            $lockedFamily = Family::query()->lockForUpdate()->findOrFail($family->id);

            if ($lockedFamily->status !== 'pending') {
                throw new \InvalidArgumentException('Family registration is not pending approval.');
            }

            $lockedFamily->update(['status' => 'active']);
        });

        try {
            Mail::raw(
                "Dear {$family->head_name},\n\n"
                . "Your family registration for the Barangay Household Portal has been approved.\n\n"
                . "You can now sign in using your registered email or phone number and PIN.\n\n"
                . "Welcome!",
                function ($message) use ($family) {
                    $message->to($family->email)
                        ->subject('Family Registration Approved - Barangay Household Portal');
                }
            );
        } catch (TransportExceptionInterface $e) {
            Log::error("Failed to send family approval email to {$family->email}: {$e->getMessage()}");

            return false;
        }

        return true;
    }

    public function reject(Family $family): bool
    {
        DB::transaction(function () use ($family) {
            $lockedFamily = Family::query()->lockForUpdate()->findOrFail($family->id);

            if ($lockedFamily->status !== 'pending') {
                throw new \InvalidArgumentException('Family registration is not pending approval.');
            }

            $lockedFamily->update(['status' => 'inactive']);
        });

        try {
            Mail::raw(
                "Dear {$family->head_name},\n\n"
                . "We regret to inform you that your family registration for the Barangay Household Portal was not approved.\n\n"
                . "Please contact your barangay administrator for more information.",
                function ($message) use ($family) {
                    $message->to($family->email)
                        ->subject('Family Registration Update - Barangay Household Portal');
                }
            );
        } catch (TransportExceptionInterface $e) {
            Log::error("Failed to send family rejection email to {$family->email}: {$e->getMessage()}");

            return false;
        }

        return true;
    }
}
