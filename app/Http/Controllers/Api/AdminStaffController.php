<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AdminStaffController extends Controller
{
    /**
     * Return all staff users whose status is 'pending'.
     */
    public function pendingStaff(): JsonResponse
    {
        $staff = User::where('status', 'pending')
            ->where('role', 'staff')
            ->with('purok:id,name')
            ->orderBy('created_at')
            ->get()
            ->map(fn (User $u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'phone'      => $u->phone,
                'purok_id'   => $u->purok_id,
                'purok'      => $u->purok ? ['id' => $u->purok->id, 'name' => $u->purok->name] : null,
                'created_at' => $u->created_at,
            ]);

        return response()->json($staff);
    }

    /**
     * Approve a pending staff registration: set status to active and email a temp password.
     */
    public function approveStaff(User $user): JsonResponse
    {
        if ($user->status !== 'pending') {
            return response()->json(['message' => 'This user is not pending approval.'], 400);
        }

        $tempPassword    = Str::random(8);
        $user->password  = $tempPassword; // cast will hash it
        $user->status    = 'active';
        $user->save();

        Mail::raw(
            "Congratulations {$user->name}, your registration has been approved.\n\n"
            . "Your temporary password is: {$tempPassword}\n\n"
            . "Please log in and change your password immediately.",
            function ($message) use ($user) {
                $message->to($user->email)
                    ->subject('Staff Registration Approved — Disaster Relief System');
            }
        );

        return response()->json(['message' => 'Staff approved.']);
    }

    /**
     * Reject a pending staff registration: delete the user and notify them by email.
     */
    public function rejectStaff(User $user): JsonResponse
    {
        if ($user->status !== 'pending') {
            return response()->json(['message' => 'This user is not pending approval.'], 400);
        }

        $email = $user->email;
        $name  = $user->name;

        Mail::raw(
            "Dear {$name},\n\n"
            . "We regret to inform you that your registration request was not approved. "
            . "Please contact the administrator for more information.",
            function ($message) use ($email) {
                $message->to($email)
                    ->subject('Staff Registration Update — Disaster Relief System');
            }
        );

        $user->delete();

        return response()->json(['message' => 'Staff registration rejected.']);
    }
}
