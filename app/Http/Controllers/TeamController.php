<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\Purok;
use App\Models\User;
use App\Services\StaffApprovalService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function __construct(private StaffApprovalService $approvalService)
    {
    }

    public function index(Request $request): Response
    {
        $members = User::query()
            ->with(['location:id,name', 'purok:id,name'])
            ->where('status', '!=', 'pending')
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($request->string('role')->toString(), fn ($query, $role) => $query->where('role', $role))
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->orderBy('name')
            ->get();

        $pendingStaff = User::where('status', 'pending')
            ->where('role', 'staff')
            ->with(['purok:id,name', 'location:id,name'])
            ->orderBy('created_at')
            ->get(['id', 'name', 'email', 'phone', 'purok_id', 'preferred_purok_ids', 'location_id', 'birthdate', 'home_address', 'created_at']);

        return Inertia::render('team-management', [
            'members'      => $members,
            'pendingStaff' => $pendingStaff,
            'locations'    => Location::where('status', 'active')->select('id', 'name')->orderBy('name')->get(),
            'filters'      => $request->only(['search', 'role', 'status']),
            'puroks'       => Purok::select('id', 'name', 'code', 'location_id', 'assigned_staff_id')
                ->where('status', 'active')
                ->whereNotNull('location_id')
                ->whereIn('name', array_map(fn ($number) => "Purok {$number}", range(1, 7)))
                ->orderBy('name')
                ->get(),
        ]);
    }

    /**
     * Admin manually creates a staff account.
     *
     * The account is immediately active and the chosen purok is assigned.
     * A welcome e-mail is sent with the temporary password.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name'             => 'required|string|max:255',
            'email'            => 'required|email|max:255|unique:users,email',
            'password'         => 'required|string|min:8',
            'role'             => 'required|in:admin,staff',
            'phone'            => 'nullable|string|max:50',
            'status'           => 'required|in:active,on_leave,inactive',
            'location_id'      => ['nullable', Rule::exists('locations', 'id')->where('status', 'active')],
            'purok_id'         => 'nullable|exists:puroks,id',
            'birthdate'        => [
                'nullable',
                'required_if:role,staff',
                'date',
                'before_or_equal:' . now()->subYears(18)->toDateString(),
            ],
            'home_address'     => 'nullable|string|max:500',
        ]);

        $plainPassword    = $data['password'];
        $data['password'] = Hash::make($data['password']);

        // Staff created by admin are immediately active and must change password on first login
        if ($data['role'] === 'staff') {
            $data['status']               = 'active';
            $data['must_change_password'] = true;
        }

        $user = DB::transaction(function () use ($data) {
            $purok = $this->validatePurokAssignment($data);
            $user = User::create($data);

            if ($purok) {
                $purok->update(['assigned_staff_id' => $user->id]);
            }

            return $user;
        });

        // Send welcome e-mail for staff accounts
        if ($user->role === 'staff') {
            $this->sendWelcomeEmail($user, $plainPassword);
        }

        return back()->with('success', 'Staff account created successfully.');
    }

    /**
     * Update an existing team member's details.
     *
     * When a staff member is deactivated their purok assignment is cleared so
     * the purok becomes available again for new registrations.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name'             => 'required|string|max:255',
            'email'            => 'required|email|max:255|unique:users,email,' . $user->id,
            'password'         => 'nullable|string|min:8',
            'role'             => 'required|in:admin,staff',
            'phone'            => 'nullable|string|max:50',
            'status'           => 'required|in:active,on_leave,inactive',
            'location_id'      => ['nullable', Rule::exists('locations', 'id')->where('status', 'active')],
            'purok_id'         => 'nullable|exists:puroks,id',
            'birthdate'        => [
                'nullable',
                'required_if:role,staff',
                'date',
                'before_or_equal:' . now()->subYears(18)->toDateString(),
            ],
            'home_address'     => 'nullable|string|max:500',
        ]);

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        DB::transaction(function () use ($data, $user) {
            $purok = $this->validatePurokAssignment($data, $user->id);
            $user->update($data);

            Purok::where('assigned_staff_id', $user->id)
                ->update(['assigned_staff_id' => null]);

            if ($purok && $data['role'] === 'staff' && $data['status'] === 'active') {
                $purok->update(['assigned_staff_id' => $user->id]);
            }
        });

        return back()->with('success', 'Team member updated successfully.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($request->user()->id === $user->id) {
            return back()->with('error', 'You cannot remove your own account.');
        }

        // Free the purok before deleting
        Purok::where('assigned_staff_id', $user->id)
            ->update(['assigned_staff_id' => null]);

        $user->delete();

        return back()->with('success', 'Team member removed successfully.');
    }

    public function approve(Request $request, User $user): RedirectResponse
    {
        if ($user->status !== 'pending') {
            return back()->with('error', 'This user is not pending approval.');
        }

        $data = $request->validate([
            'purok_id' => 'nullable|exists:puroks,id',
        ]);

        $purokId = isset($data['purok_id']) ? (int) $data['purok_id'] : null;

        if ($purokId !== null) {
            $purok = Purok::query()
                ->whereKey($purokId)
                ->where('location_id', $user->location_id)
                ->where('status', 'active')
                ->whereIn('name', array_map(fn ($number) => "Purok {$number}", range(1, 7)))
                ->first();

            if (! $purok || ($purok->assigned_staff_id !== null && (int) $purok->assigned_staff_id !== $user->id)) {
                throw ValidationException::withMessages([
                    'purok_id' => 'Choose an available Purok from the staff member’s barangay.',
                ]);
            }
        }

        $this->approvalService->approve($user, $purokId);

        return back()->with('success', 'Staff member approved and notified.');
    }

    public function reject(Request $request, User $user): RedirectResponse
    {
        if ($user->status !== 'pending') {
            return back()->with('error', 'This user is not pending approval.');
        }

        $data = $request->validate([
            'rejection_reason' => 'nullable|string|max:1000',
        ]);

        $reason = trim((string) ($data['rejection_reason'] ?? ''));

        $this->approvalService->reject($user, $reason);

        return back()->with('success', 'Registration request rejected.');
    }

    // --- Private helpers -----------------------------------------------------

    private function sendWelcomeEmail(User $user, string $plainPassword): void
    {
        $user->loadMissing(['location:id,name', 'purok:id,name']);
        $locationName = $user->location?->name ?? 'your assigned location';
        $purokName    = $user->purok?->name    ?? 'your assigned purok';

        try {
            Mail::raw(
                "Dear {$user->name},\n\n"
                . "An administrator has created a staff account for you in the "
                . "Disaster Relief Resource Management System.\n\n"
                . "Your login details:\n"
                . "  Email:    {$user->email}\n"
                . "  Password: {$plainPassword}\n\n"
                . "Your assignment:\n"
                . "  Location: {$locationName}\n"
                . "  Purok:    {$purokName}\n\n"
                . "You will be asked to change your password on first login.\n\n"
                . "Welcome to the team!",
                function ($message) use ($user) {
                    $message->to($user->email)
                        ->subject('Your Staff Account - Disaster Relief System');
                }
            );
        } catch (\Exception $e) {
            Log::error("Failed to send welcome email to {$user->email}: {$e->getMessage()}");
        }
    }

    private function validatePurokAssignment(array $data, ?int $exceptUserId = null): ?Purok
    {
        if (empty($data['purok_id'])) {
            return null;
        }

        if (empty($data['location_id']) || $data['role'] !== 'staff') {
            throw ValidationException::withMessages([
                'purok_id' => 'A Purok can only be assigned to staff in a selected barangay.',
            ]);
        }

        $purok = Purok::query()
            ->whereKey($data['purok_id'])
            ->where('location_id', $data['location_id'])
            ->where('status', 'active')
            ->whereIn('name', array_map(fn ($number) => "Purok {$number}", range(1, 7)))
            ->lockForUpdate()
            ->first();

        if (! $purok) {
            throw ValidationException::withMessages([
                'purok_id' => 'Choose a Purok from the selected barangay.',
            ]);
        }

        if ($purok->assigned_staff_id !== null && (int) $purok->assigned_staff_id !== $exceptUserId) {
            throw ValidationException::withMessages([
                'purok_id' => 'The selected Purok is already assigned to another staff member.',
            ]);
        }

        return $purok;
    }
}