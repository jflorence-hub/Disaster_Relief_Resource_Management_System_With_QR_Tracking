<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StaffApprovalService;
use Illuminate\Http\JsonResponse;

class AdminStaffController extends Controller
{
    public function __construct(private StaffApprovalService $approvalService)
    {
    }

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
     * Approve a pending staff registration.
     */
    public function approveStaff(User $user): JsonResponse
    {
        if ($user->status !== 'pending') {
            return response()->json(['message' => 'This user is not pending approval.'], 400);
        }

        $this->approvalService->approve($user);

        return response()->json(['message' => 'Staff approved. An email has been sent to the staff member.']);
    }

    /**
     * Reject a pending staff registration.
     */
    public function rejectStaff(User $user): JsonResponse
    {
        if ($user->status !== 'pending') {
            return response()->json(['message' => 'This user is not pending approval.'], 400);
        }

        $this->approvalService->reject($user);

        return response()->json(['message' => 'Staff registration rejected.']);
    }
}
