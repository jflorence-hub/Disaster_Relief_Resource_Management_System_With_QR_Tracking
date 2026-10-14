<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Models\Family;
use App\Models\Location;
use App\Models\Resource;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DistributionController extends Controller
{
    /**
     * Display distributions.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        abort_unless($user, 401);

        $mainWarehouse = Location::query()
            ->whereRaw('LOWER(name) = ?', ['main warehouse'])
            ->first(['id', 'name']);

        $scheduledAt = DB::table('distribution_schedules')
            ->orderByDesc('id')
            ->value('scheduled_at') ?? now();

        /*
         * Ensure active families have an initial distribution.
         *
         * Do not create another initial distribution for a family
         * that already has one. Scheduled distributions are separate.
         */
        Family::query()
            ->where('status', 'active')
            ->when(
                $user->role === 'staff',
                fn ($query) => $user->purok_id
                    ? $query->where('purok_id', $user->purok_id)
                    : $query->whereRaw('1 = 0')
            )
            ->orderBy('id')
            ->get()
            ->each(function (Family $family) use ($scheduledAt, $user) {
                $exists = Distribution::query()
                    ->where('family_id', $family->id)
                    ->whereNull('schedule_id')
                    ->exists();

                if ($exists) {
                    return;
                }

                Distribution::create([
                    'family_id' => $family->id,
                    'resource_id' => null,
                    'quantity' => max(
                        1,
                        (int) ceil(
                            max(1, (int) $family->household_member) / 3
                        )
                    ),
                    'additional_resource_id' => null,
                    'additional_quantity' => null,
                    'location_id' => $family->location_id,
                    'distribution_date' => $scheduledAt,
                    'recipient_name' => $family->family_name,
                    'recipient_contact' => $family->phone,
                    'household_member' => $family->household_member,
                    'distributed_by' => $user->id,
                    'status' => 'pending',
                    'notes' => null,
                    'schedule_id' => null,
                ]);
            });

        /*
         * Distributions.
         */
        $distributions = Distribution::query()
            ->with([
                'family:id,family_id,family_name,head_name,phone,household_member,purok_id',
                'resource:id,name,unit,category',
                'additionalResource:id,name,unit,category',
                'location:id,name',
                'distributor:id,name',
            ])
            ->when(
                $user->role === 'staff',
                fn ($query) => $query->whereHas(
                    'family',
                    fn ($familyQuery) => $familyQuery->where(
                        'purok_id',
                        $user->purok_id
                    )
                )
            )
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->input('search');

                $query->where(function ($q) use ($search) {
                    $q->where('recipient_name', 'like', "%{$search}%")
                        ->orWhere('recipient_contact', 'like', "%{$search}%")
                        ->orWhereHas('family', function ($familyQuery) use ($search) {
                            $familyQuery
                                ->where('family_id', 'like', "%{$search}%")
                                ->orWhere('family_name', 'like', "%{$search}%")
                                ->orWhere('head_name', 'like', "%{$search}%");
                        });
                });
            })
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where(
                    'status',
                    $request->input('status')
                )
            )
            ->orderByDesc('distribution_date')
            ->orderByDesc('id')
            ->get();

        /*
         * Active families.
         */
        $families = Family::query()
            ->with('purok:id,name')
            ->where('status', 'active')
            ->when(
                $user->role === 'staff',
                fn ($query) => $query->where(
                    'purok_id',
                    $user->purok_id
                )
            )
            ->orderBy('family_name')
            ->get([
                'id',
                'family_id',
                'family_name',
                'head_name',
                'phone',
                'household_member',
                'address',
                'purok_id',
                'status',
            ]);

        /*
         * Resources.
         */
        $resources = Resource::query()
            ->when(
                $user->role === 'admin',
                fn ($query) => $mainWarehouse
                    ? $query->where('location_id', $mainWarehouse->id)
                    : $query->whereRaw('1 = 0')
            )
            ->when(
                $user->role === 'staff',
                fn ($query) => $query->where(
                    'location_id',
                    $user->location_id
                )
            )
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'unit',
                'category',
                'quantity',
            ]);

        /*
         * Active locations.
         */
        $locations = Location::query()
            ->where('status', 'active')
            ->when(
                $user->role === 'staff',
                fn ($query) => $user->location_id
                    ? $query->whereKey($user->location_id)
                    : $query->whereRaw('1 = 0')
            )
            ->orderBy('name')
            ->get(['id', 'name']);

        /*
         * Staff accounts.
         */
        $staff = User::query()
            ->where('role', 'staff')
            ->when(
                $user->role === 'staff',
                fn ($query) => $query->whereKey($user->id)
            )
            ->orderBy('name')
            ->get(['id', 'name', 'purok_id']);

        return Inertia::render('distribution', [
            'distributions' => $distributions,
            'userRole' => $user->role,
            'resources' => $resources,
            'locations' => $locations,
            'families' => $families,
            'staff' => $staff,
            'filters' => $request->only(['search', 'status']),
            'currentDate' => now()->format('Y-m-d\TH:i'),
            'scheduledAt' => date(
                'Y-m-d\TH:i',
                strtotime((string) $scheduledAt)
            ),
            'defaultSetResource' => null,

            /*
             * Puroks for the history purok-filter dropdown.
             * Staff only see their own purok.
             */
            'puroks' => \App\Models\Purok::query()
                ->where('status', 'active')
                ->when(
                    $user->role === 'staff' && $user->purok_id,
                    fn ($q) => $q->whereKey($user->purok_id)
                )
                ->orderBy('name')
                ->get(['id', 'name']),

            /*
             * All past distribution schedules for the history dropdown.
             * Each entry includes its distributions (with family info)
             * so the frontend can render the per-schedule family list.
             */
            'scheduleHistory' => DB::table('distribution_schedules as s')
                ->leftJoin('resources as r', 'r.id', '=', 's.resource_id')
                ->leftJoin('locations as l', 'l.id', '=', 's.location_id')
                ->orderByDesc('s.scheduled_at')
                ->get([
                    's.id',
                    's.scheduled_at',
                    'r.name as resource_name',
                    'l.name as location_name',
                ])
                ->map(function ($schedule) use ($user) {
                    $familyDistributions = DB::table('distributions as d')
                        ->join('families as f', 'f.id', '=', 'd.family_id')
                        ->leftJoin('puroks as p',     'p.id', '=', 'f.purok_id')
                        ->leftJoin('resources as r2', 'r2.id', '=', 'd.resource_id')
                        ->leftJoin('resources as r3', 'r3.id', '=', 'd.additional_resource_id')
                        ->leftJoin('users as u',      'u.id',  '=', 'd.distributed_by')
                        ->where('d.schedule_id', $schedule->id)
                        ->when(
                            $user->role === 'staff',
                            fn ($q) => $q->where('f.purok_id', $user->purok_id)
                        )
                        ->get([
                            'd.id',
                            'd.status',
                            'd.quantity',
                            'd.additional_quantity',
                            'f.family_id as family_code',
                            'f.family_name',
                            'f.head_name',
                            'f.household_member',
                            'p.name as purok_name',
                            'r2.name as resource_name',
                            'r2.unit as resource_unit',
                            'r3.name as additional_resource_name',
                            'r3.unit as additional_resource_unit',
                            'u.name as scanned_by',
                        ]);

                    return [
                        'id'            => $schedule->id,
                        'scheduled_at'  => $schedule->scheduled_at,
                        'resource_name' => $schedule->resource_name,
                        'location_name' => $schedule->location_name,
                        'families'      => $familyDistributions,
                    ];
                }),
        ]);
    }

    /**
     * Manually create a distribution.
     */
    public function store(Request $request): RedirectResponse
    {
        abort_unless(
            $request->user()?->role === 'admin',
            403,
            'Only administrators can add distributions.'
        );

        $data = $this->validateDistribution($request);

        $family = Family::findOrFail($data['family_id']);

        $this->checkStaffAccess($request, $family);

        $data['recipient_name'] = $family->family_name;
        $data['recipient_contact'] = $family->phone;
        $data['household_member'] = $family->household_member;
        $data['distributed_by'] = $request->user()->id;
        $data['quantity'] = max(
            1,
            (int) ceil(max(1, (int) $family->household_member) / 3)
        );
        $data['distribution_date'] = DB::table('distribution_schedules')
            ->orderByDesc('id')
            ->value('scheduled_at') ?? now();

        $distribution = DB::transaction(function () use ($data) {
            $distribution = Distribution::create($data);

            if (
                $distribution->status === 'completed'
                && (
                    $distribution->resource_id
                    || $distribution->additional_resource_id
                )
            ) {
                $distribution->applyStock();
            }

            return $distribution;
        });

        return redirect()
            ->route('distribution.index')
            ->with('success', 'Distribution saved successfully.');
    }

    /**
     * Update an existing distribution.
     */
    public function update(
        Request $request,
        Distribution $distribution
    ): RedirectResponse {
        abort_unless(
            $request->user()?->role === 'admin',
            403,
            'Only administrators can edit distributions.'
        );

        $data = $request->validate([
            'family_id' => ['required', 'exists:families,id'],
            'resource_id' => ['nullable', 'exists:resources,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'additional_resource_id' => [
                'nullable',
                'exists:resources,id',
                'different:resource_id',
            ],
            'additional_quantity' => [
                'nullable',
                'integer',
                'min:1',
                'required_with:additional_resource_id',
            ],
            'location_id' => ['nullable', 'exists:locations,id'],
            'status' => [
                'required',
                'in:pending,in_transit,completed,cancelled',
            ],
            'notes'    => ['nullable', 'string'],
            'reason'   => ['nullable', 'string'],
            'disaster' => ['nullable', 'string', 'in:Typhoon,Flood,Earthquake,Fire,Drought,Landslide,Volcanic Eruption,Other'],
        ]);

        $family = Family::findOrFail($data['family_id']);

        $this->checkStaffAccess($request, $family);

        DB::transaction(function () use ($distribution, $data, $family) {
            $distribution = Distribution::query()
                ->whereKey($distribution->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($distribution->status === 'completed') {
                $distribution->reverseStock();
            }

            $distribution->family_id = $family->id;
            $distribution->recipient_name = $family->family_name;
            $distribution->recipient_contact = $family->phone;
            $distribution->household_member = $family->household_member;

            $distribution->resource_id = $data['resource_id'] ?? null;
            $distribution->quantity = max(
                1,
                (int) ceil(max(1, (int) $family->household_member) / 3)
            );

            $distribution->additional_resource_id =
                $data['additional_resource_id'] ?? null;

            $distribution->additional_quantity =
                !empty($data['additional_resource_id'])
                    ? (int) ($data['additional_quantity'] ?? 1)
                    : null;

            $distribution->location_id = $data['location_id'] ?? null;

            $distribution->distribution_date =
                DB::table('distribution_schedules')
                    ->orderByDesc('id')
                    ->value('scheduled_at') ?? now();

            $distribution->status = $data['status'];
            $distribution->notes = $data['notes'] ?? null;
            $distribution->reason = $data['reason'] ?? null;
            $distribution->disaster = $data['disaster'] ?? null;

            $distribution->save();

            if (
                $distribution->status === 'completed'
                && (
                    $distribution->resource_id
                    || $distribution->additional_resource_id
                )
            ) {
                $distribution->applyStock();
            }
        });

        return redirect()
            ->route('distribution.index')
            ->with('success', 'Distribution updated successfully.');
    }

    /**
     * Delete a distribution.
     */
    public function destroy(
        Request $request,
        Distribution $distribution
    ): RedirectResponse {
        abort_unless(
            $request->user()?->role === 'admin',
            403,
            'Only administrators can delete distributions.'
        );

        DB::transaction(function () use ($distribution) {
            $lockedDistribution = Distribution::query()
                ->whereKey($distribution->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedDistribution->status === 'completed') {
                $lockedDistribution->reverseStock();
            }

            $lockedDistribution->delete();
        });

        return redirect()
            ->route('distribution.index')
            ->with('success', 'Distribution deleted successfully.');
    }

    /**
     * Create a schedule and one distribution per active family.
     */
    public function updateSchedule(Request $request): RedirectResponse
    {
        abort_unless(
            $request->user()?->role === 'admin',
            403,
            'Only administrators can add distribution schedules.'
        );

        $data = $request->validate([
            'scheduled_at' => ['required', 'date'],
            'resource_id'  => ['required', 'exists:resources,id'],
            'location_id'  => ['nullable', 'exists:locations,id'],
        ]);

        DB::transaction(function () use ($request, $data) {
            $scheduledAt = date(
                'Y-m-d H:i:s',
                strtotime($data['scheduled_at'])
            );

            $scheduleId = DB::table('distribution_schedules')->insertGetId([
                'scheduled_at' => $scheduledAt,
                'resource_id'  => $data['resource_id'],
                'location_id'  => $data['location_id'] ?? null,
                'set_by'       => $request->user()->id,
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);

            Family::query()
                ->where('status', 'active')
                ->orderBy('id')
                ->each(function (Family $family) use (
                    $request,
                    $data,
                    $scheduledAt,
                    $scheduleId
                ) {
                    Distribution::create([
                        'family_id' => $family->id,
                        'resource_id' => $data['resource_id'],
                        'quantity' => max(
                            1,
                            (int) ceil(
                                max(1, (int) $family->household_member) / 3
                            )
                        ),
                        'additional_resource_id' => null,
                        'additional_quantity' => null,
                        'location_id' => $family->location_id,
                        'distribution_date' => $scheduledAt,
                        'recipient_name' => $family->family_name,
                        'recipient_contact' => $family->phone,
                        'household_member' => $family->household_member,
                        'distributed_by' => $request->user()->id,
                        'status' => 'pending',
                        'notes' => null,
                        'schedule_id' => $scheduleId,
                    ]);
                });
        });

        return redirect()
            ->route('distribution.index')
            ->with(
                'success',
                'New relief distribution schedule added for all registered families.'
            );
    }

    /**
     * Validate distribution input.
     */
    private function validateDistribution(Request $request): array
    {
        return $request->validate([
            'family_id' => ['required', 'exists:families,id'],
            'resource_id' => ['nullable', 'exists:resources,id'],
            'additional_resource_id' => [
                'nullable',
                'exists:resources,id',
                'different:resource_id',
            ],
            'location_id' => ['nullable', 'exists:locations,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'additional_quantity' => [
                'nullable',
                'integer',
                'min:1',
                'required_with:additional_resource_id',
            ],
            'status' => [
                'required',
                'in:pending,in_transit,completed,cancelled',
            ],
            'notes'    => ['nullable', 'string'],
            'reason'   => ['nullable', 'string'],
            'disaster' => ['nullable', 'string', 'in:Typhoon,Flood,Earthquake,Fire,Drought,Landslide,Volcanic Eruption,Other'],
        ]);
    }

    /**
     * Check staff Purok access.
     */
    private function checkStaffAccess(
        Request $request,
        Family $family
    ): void {
        $user = $request->user();

        if (
            $user?->role === 'staff'
            && (int) $family->purok_id !== (int) $user->purok_id
        ) {
            abort(
                403,
                'You cannot distribute to a family outside your Purok.'
            );
        }
    }

    /**
     * Distribution history API.
     */
    public function history(Request $request)
    {
        $user = $request->user();

        abort_unless($user, 401);

        $history = Distribution::query()
            ->with([
                'family:id,family_id,family_name,head_name,household_member,purok_id',
                'resource:id,name,unit',
                'additionalResource:id,name,unit',
                'location:id,name',
                'distributor:id,name',
            ])
            ->when(
                $user->role === 'staff',
                fn ($query) => $query->whereHas(
                    'family',
                    fn ($familyQuery) => $familyQuery->where(
                        'purok_id',
                        $user->purok_id
                    )
                )
            )
            ->orderByDesc('distribution_date')
            ->orderByDesc('id')
            ->get();

        return response()->json($history);
    }
}
