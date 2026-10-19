<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\Distribution;
use App\Models\Purok;
use App\Models\Resource;
use App\Models\User;
use App\Models\Location;
use App\Services\FamilyApprovalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class FamilyController extends Controller
{
    public function __construct(private FamilyApprovalService $approvalService)
    {
    }

    public function index(Request $request): Response
    {
        $user = $request->user();

        $families = Family::query()
            ->where('status', '!=', 'pending')
            ->with([
                'purok:id,name',
                'location:id,name,status',
                'household_member:id,family_id,household_member_number,name',
            ])
            ->when(
                $user->role === 'staff',
                fn($query) => $user->purok_id
                    ? $query->where('purok_id', $user->purok_id)
                    : $query->whereRaw('1 = 0')
            )
            ->when(
                $request->string('search')->toString(),
                function ($query, $search) {
                    $query->where(function ($q) use ($search) {
                        $q->where(
                            'family_id',
                            'like',
                            "%{$search}%"
                        )
                            ->orWhere(
                                'head_name',
                                'like',
                                "%{$search}%"
                            )
                            ->orWhere(
                                'phone',
                                'like',
                                "%{$search}%"
                            )
                            ->orWhere(
                                'email',
                                'like',
                                "%{$search}%"
                            );
                    });
                }
            )
            ->orderBy('head_name')
            ->select([
                'id',
                'family_id',
                'qr_code',
                'head_name',
                'email',
                'phone',
                'household_member',
                'purok_id',
                'location_id',
                'status',
            ])
            ->get();

        $pendingFamilies = $user->role === 'admin'
            ? Family::query()
                ->with(['purok:id,name', 'location:id,name,status', 'household_member:id,family_id,household_member_number,name'])
                ->where('status', 'pending')
                ->orderBy('created_at')
                ->get([
                    'id', 'family_id', 'qr_code', 'head_name', 'email', 'phone',
                    'household_member', 'purok_id', 'location_id', 'status', 'created_at',
                ])
            : [];

        $puroks = Purok::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'code',
                'location_id',
            ]);

        /*
         * Only ACTIVE locations are sent
         * to the Family page.
         */
        $locations = Location::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'status',
            ]);

        $staff = User::query()
            ->where('role', 'staff')
            ->when($user->role === 'staff', fn ($q) => $q->whereKey($user->id))
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'purok_id',
            ]);

        $allLocations = Location::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'status']);

        return Inertia::render('families', [
            'families'     => $families,
            'pendingFamilies' => $pendingFamilies,
            'userRole'     => $user->role,
            'puroks'       => $puroks,
            'locations'    => $locations,
            'allLocations' => $allLocations,
            'staff'        => $staff,
            'filters'      => $request->only(['search', 'location_id']),
        ]);
    }

    public function approve(Family $family): RedirectResponse
    {
        if ($family->status !== 'pending') {
            return back()->with('error', 'This family registration is not pending approval.');
        }

        $emailSent = $this->approvalService->approve($family);

        return $emailSent
            ? back()->with('success', 'Family registration approved and acceptance email sent.')
            : back()->with('error', 'Family registration was approved, but the acceptance email could not be sent. Check the mail configuration and logs.');
    }

    public function reject(Family $family): RedirectResponse
    {
        if ($family->status !== 'pending') {
            return back()->with('error', 'This family registration is not pending approval.');
        }

        $emailSent = $this->approvalService->reject($family);

        return $emailSent
            ? back()->with('success', 'Family registration rejected and the applicant was notified.')
            : back()->with('error', 'Family registration was rejected, but the notification email could not be sent. Check the mail configuration and logs.');
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        if ($request->filled('email')) {
            $request->merge(['email' => strtolower(trim($request->input('email')))]);
        }

        $data = $request->validate([
            'head_name' => [
                'required',
                'string',
                'max:255',
            ],

            'phone' => [
                'nullable',
                'string',
                'max:50',
            ],

            'email' => [
                'nullable',
                'email',
                'max:255',
                'unique:families,email',
            ],

            'household_member' => [
                'required',
                'integer',
                'min:1',
            ],

            /*
             * Location is now required.
             */
            'location_id' => [
                'required',
                'exists:locations,id',
            ],

            'purok_id' => [
                'required',
                'exists:puroks,id',
            ],

            'pin' => [
                'required',
                'string',
                'min:4',
                'max:20',
            ],

            'status' => [
                'required',
                'in:active,inactive',
            ],

            'member_names'   => ['nullable', 'array'],
            'member_names.*' => ['nullable', 'string', 'max:255'],
        ]);

        /*
         * Duplicate member name check (case-insensitive).
         */
        if (!empty($data['member_names'])) {
            foreach (array_filter($data['member_names'], fn ($n) => !empty(trim((string) $n))) as $name) {
                $exists = \App\Models\HouseholdMember::whereRaw(
                    'LOWER(TRIM(name)) = ?',
                    [strtolower(trim($name))]
                )->exists();

                if ($exists) {
                    return back()->withErrors([
                        'member_names' => "The name \"{$name}\" is already registered as a household member in another family.",
                    ]);
                }
            }
        }

        /*
         * Staff can only register families
         * inside their assigned Purok.
         */
        if (
            $user->role === 'staff' &&
            (int) $data['purok_id'] !==
            (int) $user->purok_id
        ) {
            abort(
                403,
                'You can only manage families in your assigned Purok.'
            );
        }

        /*
         * Make sure the selected location
         * is ACTIVE.
         */
        $location = Location::query()
            ->where('id', $data['location_id'])
            ->where('status', 'active')
            ->first();

        if (!$location) {
            return back()->withErrors([
                'location_id' =>
                    'The selected location is not active.',
            ]);
        }

        if (!Purok::query()->whereKey($data['purok_id'])
            ->where('location_id', $location->id)
            ->where('status', 'active')
            ->exists()) {
            return back()->withErrors([
                'purok_id' => 'The selected Purok must belong to the selected location.',
            ]);
        }

        DB::transaction(function () use ($data, $user) {
            /*
             * Hash PIN.
             */
            $data['pin'] =
                Hash::make($data['pin']);

            /*
             * Create family.
             *
             * location_id is automatically
             * saved with the family.
             */
            $family = Family::create($data);

            /*
             * Create beneficiaries.
             */
            $this->syncHousehold_member($family, $data['member_names'] ?? null);

            // Initial relief is intentionally unassigned until an administrator creates a schedule.
            $scheduledAt = DB::table('distribution_schedules')->orderByDesc('id')->value('scheduled_at') ?? now();
            Distribution::firstOrCreate(
                ['family_id' => $family->id, 'schedule_id' => null],
                [
                    'resource_id' => null,
                    'quantity' => max(1, (int) ceil(max(1, (int) $family->household_member) / 3)),
                    'additional_resource_id' => null,
                    'additional_quantity' => null,
                    'location_id' => $family->location_id,
                    'distribution_date' => $scheduledAt,
                    'recipient_name' => $family->head_name,
                    'recipient_contact' => $family->phone,
                    'household_member' => $family->household_member,
                    'distributed_by' => $user->id,
                    'status' => 'pending',
                    'notes' => null,
                ]
            );
        });

        return back()->with(
            'success',
            'Family added successfully.'
        );
    }

    /**
     * Return household members for a family as JSON (used by admin web frontend).
     */
    public function members(Family $family): JsonResponse
    {
        $members = $family->household_member()
            ->orderBy('household_member_number')
            ->get(['id', 'household_member_number', 'name'])
            ->map(fn ($m) => [
                'id'     => $m->id,
                'number' => $m->household_member_number,
                'name'   => $m->display_name,
            ]);

        return response()->json(['members' => $members]);
    }

    /**
     * Create beneficiary records.
     */
    private function syncHousehold_member(
        Family $family,
        ?array $names = null
    ): void {
        $count =
            (int) $family->household_member;

        $family
            ->household_member()
            ->delete();

        for (
            $i = 1;
            $i <= $count;
            $i++
        ) {
            $family
                ->household_member()
                ->create([
                    'household_member_number' => $i,
                    'name' => $names[$i - 1] ?? null,
                ]);
        }
    }

    /**
     * Update a family.
     */
    public function update(
        Request $request,
        Family $family
    ): RedirectResponse {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can edit families.');
        $user = $request->user();
        if ($request->filled('email')) {
            $request->merge(['email' => strtolower(trim($request->input('email')))]);
        }

        if (
            $user->role === 'staff' &&
            (int) $family->purok_id !==
            (int) $user->purok_id
        ) {
            abort(403);
        }

        $data = $request->validate([
            'head_name' => [
                'required',
                'string',
                'max:255',
            ],

            'phone' => [
                'nullable',
                'string',
                'max:50',
            ],

            'email' => [
                'nullable',
                'email',
                'max:255',
                'unique:families,email,' . $family->id,
            ],

            'household_member' => [
                'required',
                'integer',
                'min:1',
            ],

            /*
             * Location is required when editing too.
             */
            'location_id' => [
                'required',
                'exists:locations,id',
            ],

            'purok_id' => [
                'required',
                'exists:puroks,id',
            ],

            'pin' => [
                'nullable',
                'string',
                'min:4',
                'max:20',
            ],

            'status' => [
                'required',
                'in:active,inactive',
            ],

            'member_names'   => ['nullable', 'array'],
            'member_names.*' => ['nullable', 'string', 'max:255'],
        ]);

        if (
            $user->role === 'staff' &&
            (int) $data['purok_id'] !==
            (int) $user->purok_id
        ) {
            abort(
                403,
                'You cannot move a family outside your assigned Purok.'
            );
        }

        /*
         * Make sure the new location
         * is active.
         */
        $location = Location::query()
            ->where('id', $data['location_id'])
            ->where('status', 'active')
            ->first();

        if (!$location) {
            return back()->withErrors([
                'location_id' =>
                    'The selected location is not active.',
            ]);
        }

        if (!Purok::query()->whereKey($data['purok_id'])
            ->where('location_id', $location->id)
            ->where('status', 'active')
            ->exists()) {
            return back()->withErrors([
                'purok_id' => 'The selected Purok must belong to the selected location.',
            ]);
        }

        /*
         * Update PIN only if a new PIN
         * was entered.
         */
        if (!empty($data['pin'])) {
            $data['pin'] =
                Hash::make($data['pin']);
        } else {
            unset($data['pin']);
        }

        DB::transaction(function () use ($family, $data) {
            /*
             * Update family.
             */
            $family->update($data);

            /*
             * Recreate beneficiaries.
             */
            $this->syncHousehold_member($family, $data['member_names'] ?? null);

            /*
             * Keep existing distribution
             * information synchronized.
             */
            Distribution::where(
                'family_id',
                $family->id
            )->update([
                        'location_id' =>
                            $family->location_id,

                        'recipient_name' =>
                            $family->head_name,

                        'recipient_contact' =>
                            $family->phone,

                        'household_member' =>
                            $family->household_member,
                        'quantity' => max(1, (int) ceil(max(1, (int) $family->household_member) / 3)),
                    ]);
        });

        return back()->with(
            'success',
            'Family updated successfully.'
        );
    }

    /**
     * Delete a family and related records.
     */
    public function destroy(
        Request $request,
        Family $family
    ): RedirectResponse {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can delete families.');
        $user = $request->user();

        if (
            $user->role === 'staff' &&
            (int) $family->purok_id !==
            (int) $user->purok_id
        ) {
            abort(403);
        }

        DB::transaction(function () use ($family) {
            /*
             * Restore stock for completed
             * distributions before deleting.
             */
            $distributions =
                $family
                    ->distributions()
                    ->get();

            foreach (
                $distributions as
                $distribution
            ) {
                if (
                    $distribution->status ===
                    'completed'
                ) {
                    $distribution
                        ->reverseStock();
                }

                $distribution->delete();
            }

            /*
             * Delete beneficiaries.
             */
            $family
                ->household_member()
                ->delete();

            /*
             * Delete family.
             */
            $family->delete();
        });

        return back()->with(
            'success',
            'Family and related distribution records deleted successfully.'
        );
    }
}