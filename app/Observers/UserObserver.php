<?php

namespace App\Observers;

use App\Models\User;

class UserObserver
{
    /**
     * Auto-generate a unique STAFF-XXXXXX identifier before a User is created.
     *
     * The 6-digit suffix is randomly generated (not auto-increment) and
     * checked against the database before being assigned.  In the unlikely
     * event of a collision the loop simply retries.
     *
     * Only assigns a staff_id when the user has the 'staff' role and no
     * staff_id has already been set (e.g. from a seeder or import).
     */
    public function creating(User $user): void
    {
        if ($user->role !== 'staff' || ! empty($user->staff_id)) {
            return;
        }

        $user->staff_id = $this->generateUniqueStaffId();
    }

    private function generateUniqueStaffId(): string
    {
        do {
            $candidate = 'STAFF-' . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        } while (User::where('staff_id', $candidate)->exists());

        return $candidate;
    }
}