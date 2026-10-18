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

        // Fetch all schedules with resource and location names so the
        // frontend can list them in a filter dropdown.
        $scheduleSetNames = DB::table('distributions as d')
            ->join('resource_sets as rs', 'rs.id', '=', 'd.resource_set_id')
            ->whereNotNull('d.schedule_id')
            ->selectRaw('d.schedule_id, MIN(rs.name) as resource_name')
            ->groupBy('d.schedule_id');

        $schedules = DB::table('distribution_schedules as s')
            ->leftJoin('resources as r', 'r.id', '=', 's.resource_id')
            ->leftJoin('locations as l', 'l.id', '=', 's.location_id')
            ->leftJoinSub($scheduleSetNames, 'ss', 'ss.schedule_id', '=', 's.id')
            ->orderByDesc('s.id')
            ->get([
                's.id',
                's.scheduled_at',
                's.location_id',
                's.cancelled_at',
                DB::raw('COALESCE(ss.resource_name, r.name) as resource_name'),
                'l.name as location_name',
            ]);

        $scheduleCounts = DB::table('distributions')
            ->whereNotNull('schedule_id')
            ->selectRaw("
                schedule_id,
                SUM(CASE WHEN status IN ('pending', 'in_transit') THEN 1 ELSE 0 END) as active_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
            ")
            ->groupBy('schedule_id')
            ->get()
            ->keyBy('schedule_id');

        /*
         * Ensure active families have an initial distribution.
         *
         * Do not create another initial distribution for a family
         * that already has one. Scheduled distributions are separate.
         */
        Family::query()
            ->where('status', 'active')
            ->when(
                $user->role === 'admin' && $request->filled('location_id'),
                fn ($query) => $query->where('location_id', (int) $request->input('location_id'))
            )
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
                    'recipient_name' => $family->head_name,
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
                'family:id,family_id,head_name,phone,household_member,purok_id',
                'resource:id,name,unit,category',
                'resourceSet:id,name',
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
            ->when(
                $request->filled('location_id'),
                fn ($query) => $query->whereHas(
                    'family',
                    fn ($q) => $q->where('location_id', (int) $request->input('location_id'))
                )
            )
            ->orderByDesc('distribution_date')
            ->orderByDesc('id')
            ->get();

        /*
         * Active families.
         * For admin: scoped to the location_id filter when present, so the
         * stat cards and family dropdown always reflect the selected barangay.
         * For staff: scoped to their own purok (unchanged).
         */
        $families = Family::query()
            ->with('purok:id,name')
            ->where('status', 'active')
            ->when(
                $user->role === 'admin' && $request->filled('location_id'),
                fn ($query) => $query->where('location_id', (int) $request->input('location_id'))
            )
            ->when(
                $user->role === 'staff',
                fn ($query) => $query->where(
                    'purok_id',
                    $user->purok_id
                )
            )
            ->orderBy('head_name')
            ->get([
                'id',
                'family_id',
                'head_name',
                'phone',
                'household_member',
                'purok_id',
                'location_id',
                'status',
            ]);

        /*
         * Resources — load from all active locations so the schedule
         * modal can pick resources regardless of where they're stored.
         */
        $reservedResourceQuantities = $this->getReservedResourceQuantities();

        $resources = Resource::query()
            ->with('location:id,name')
            ->when(
                $user->role === 'staff',
                fn ($query) => $query->where('location_id', $user->location_id)
            )
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'unit',
                'category',
                'quantity',
                'location_id',
            ])
            ->map(fn (Resource $resource) => array_merge(
                $resource->toArray(),
                ['available_quantity' => max(
                    0,
                    (int) $resource->quantity - ($reservedResourceQuantities[$resource->id] ?? 0)
                )]
            ));

        $scheduleFamilyNeeds = Family::query()
            ->where('status', 'active')
            ->get(['location_id', 'household_member'])
            ->reduce(function (array $needs, Family $family) {
                $quantity = max(1, (int) ceil(max(1, (int) $family->household_member) / 3));
                $needs['all']['families']++;
                $needs['all']['quantity'] += $quantity;

                if ($family->location_id !== null) {
                    $locationKey = (string) $family->location_id;
                    $needs['by_location'][$locationKey]['families'] =
                        ($needs['by_location'][$locationKey]['families'] ?? 0) + 1;
                    $needs['by_location'][$locationKey]['quantity'] =
                        ($needs['by_location'][$locationKey]['quantity'] ?? 0) + $quantity;
                }

                return $needs;
            }, ['all' => ['families' => 0, 'quantity' => 0], 'by_location' => []]);

        $reservedSetCounts = Distribution::query()
            ->whereNotNull('resource_set_id')
            ->whereIn('status', ['pending', 'in_transit'])
            ->where('excluded', false)
            ->selectRaw('resource_set_id, COUNT(*) as reserved_count')
            ->groupBy('resource_set_id')
            ->pluck('reserved_count', 'resource_set_id');

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
            ->with('purok:id,name')
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
            'allLocations' => Location::query()
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name']),
            'staff' => $staff,
            'filters' => $request->only(['search', 'status', 'location_id']),
            'currentDate' => now()->format('Y-m-d\TH:i'),
            'scheduledAt' => date(
                'Y-m-d\TH:i',
                strtotime((string) $scheduledAt)
            ),
            'defaultSetResource' => null,
            'scheduleFamilyNeeds' => $scheduleFamilyNeeds,
            'resourceSets' => \App\Models\ResourceSet::query()
                ->with(['items.resource:id,name,unit', 'location:id,name'])
                ->orderBy('name')
                ->get()
                ->map(function (\App\Models\ResourceSet $set) use ($reservedSetCounts) {
                    $reserved = (int) ($reservedSetCounts[$set->id] ?? 0);
                    return array_merge($set->toArray(), [
                        'available_sets' => max(
                            0,
                            (int) ($set->sets_remaining ?? $set->num_sets ?? 0) - $reserved
                        ),
                    ]);
                }),
            'schedules' => $schedules->map(function ($s) use ($scheduleCounts) {
                $counts = $scheduleCounts[$s->id] ?? null;
                return [
                    'id'            => $s->id,
                    'scheduled_at'   => $s->scheduled_at,
                    'resource_name' => $s->resource_name,
                    'location_name' => $s->location_name,
                    'location_id'   => $s->location_id,
                    'active_count' => (int) ($counts?->active_count ?? 0),
                    'completed_count' => (int) ($counts?->completed_count ?? 0),
                    'cancelled_count' => (int) ($counts?->cancelled_count ?? 0),
                    'cancelled_at' => $s->cancelled_at,
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

        $data['recipient_name'] = $family->head_name;
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

        $distribution = DB::transaction(function () use ($data, $request) {
            $this->assertDistributionStockAvailable($data);

            $distribution = Distribution::create([
                'family_id'           => $data['family_id'],
                'resource_id'         => $data['resource_id'] ?? null,
                'resource_set_id'     => ($data['assignment_mode'] ?? null) === 'set' ? ($data['resource_set_id'] ?? null) : null,
                'assignment_mode'     => $data['assignment_mode'] ?? null,
                'additional_resource_id' => $data['additional_resource_id'] ?? null,
                'location_id'         => $data['location_id'] ?? null,
                'distributed_by'      => $data['distributed_by'],
                'quantity'            => $data['quantity'],
                'additional_quantity' => $data['additional_quantity'] ?? null,
                'recipient_name'      => $data['recipient_name'],
                'recipient_contact'   => $data['recipient_contact'],
                'household_member'    => $data['household_member'],
                'distribution_date'   => $data['distribution_date'],
                'status'              => $data['status'],
                'notes'               => $data['notes'] ?? null,
                'reason'              => $data['reason'] ?? null,
                'disaster'            => $data['disaster'] ?? null,
            ]);

            if (($data['assignment_mode'] ?? null) === 'individual' && !empty($data['items'])) {
                foreach ($data['items'] as $item) {
                    $distribution->items()->create([
                        'resource_id' => $item['resource_id'],
                        'quantity'    => (int) $item['quantity'],
                    ]);
                }
            }

            if (
                $distribution->status === 'completed'
                && (
                    $distribution->resource_id
                    || $distribution->additional_resource_id
                    || $distribution->resource_set_id
                    || $distribution->items()->exists()
                )
            ) {
                $distribution->load('items');
                $distribution->applyStock();
            }

            return $distribution;
        });

        $stockWarnings = $this->calculateStockWarnings($distribution->fresh(['items']));

        return redirect()
            ->route('distribution.index')
            ->with('success', 'Distribution saved successfully.')
            ->with('stock_warnings', $stockWarnings);
    }

    /**
     * Update an existing distribution.
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
            'assignment_mode'     => ['nullable', 'in:set,individual'],
            'resource_set_id'     => ['nullable', 'exists:resource_sets,id'],
            'items'               => ['nullable', 'array'],
            'items.*.resource_id' => ['required_with:items', 'exists:resources,id'],
            'items.*.quantity'    => ['required_with:items', 'integer', 'min:1'],
        ]);

        $family = Family::findOrFail($data['family_id']);

        $this->checkStaffAccess($request, $family);

        $updatedDistribution = null;

        DB::transaction(function () use ($distribution, $data, $family, &$updatedDistribution) {
            $dist = Distribution::query()
                ->whereKey($distribution->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($dist->status === 'completed') {
                $dist->reverseStock();
            }

            $this->assertDistributionStockAvailable($data, $dist->id);

            $dist->family_id = $family->id;
            $dist->recipient_name = $family->head_name;
            $dist->recipient_contact = $family->phone;
            $dist->household_member = $family->household_member;
            $dist->resource_id = $data['resource_id'] ?? null;
            $dist->quantity = max(1, (int) ceil(max(1, (int) $family->household_member) / 3));
            $dist->additional_resource_id = $data['additional_resource_id'] ?? null;
            $dist->additional_quantity = !empty($data['additional_resource_id'])
                ? (int) ($data['additional_quantity'] ?? 1)
                : null;
            $dist->location_id = $data['location_id'] ?? null;
            $dist->distribution_date = DB::table('distribution_schedules')
                ->orderByDesc('id')
                ->value('scheduled_at') ?? now();
            $dist->status = $data['status'];
            $dist->notes = $data['notes'] ?? null;
            $dist->reason = $data['reason'] ?? null;
            $dist->disaster = $data['disaster'] ?? null;

            // Assignment mode handling
            $mode = $data['assignment_mode'] ?? null;
            if ($mode === 'set') {
                $dist->items()->delete();
                $dist->resource_set_id = $data['resource_set_id'] ?? null;
                $dist->assignment_mode = 'set';
            } elseif ($mode === 'individual') {
                $dist->resource_set_id = null;
                $dist->assignment_mode = 'individual';
            } else {
                $dist->assignment_mode = $dist->getOriginal('assignment_mode');
            }

            $dist->save();

            if ($mode === 'individual' && !empty($data['items'])) {
                $dist->items()->delete();
                foreach ($data['items'] as $item) {
                    $dist->items()->create([
                        'resource_id' => $item['resource_id'],
                        'quantity'    => (int) $item['quantity'],
                    ]);
                }
            }

            if (
                $dist->status === 'completed'
                && (
                    $dist->resource_id
                    || $dist->additional_resource_id
                    || $dist->resource_set_id
                    || $dist->items()->exists()
                )
            ) {
                $dist->load('items');
                $dist->applyStock();
            }

            $updatedDistribution = $dist;
        });

        $stockWarnings = $updatedDistribution
            ? $this->calculateStockWarnings($updatedDistribution->fresh(['items']))
            : [];

        return redirect()
            ->route('distribution.index')
            ->with('success', 'Distribution updated successfully.')
            ->with('stock_warnings', $stockWarnings);
    }
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
            'scheduled_at'        => ['required', 'date'],
            'resource_id'         => ['required', 'exists:resources,id'],
            'location_id'         => ['nullable', 'exists:locations,id'],
            'assignment_mode'     => ['required', 'in:set,individual'],
            'resource_set_id'     => ['required_if:assignment_mode,set', 'nullable', 'exists:resource_sets,id'],
        ]);

        DB::transaction(function () use ($request, $data) {
            $families = Family::query()
                ->where('status', 'active')
                ->when(
                    ! empty($data['location_id']),
                    fn ($query) => $query->where('location_id', $data['location_id'])
                )
                ->orderBy('id')
                ->get(['id', 'head_name', 'phone', 'household_member', 'location_id']);

            if ($families->isEmpty()) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'location_id' => 'There are no active families at the selected location.',
                ]);
            }

            if ($data['assignment_mode'] === 'set') {
                $set = \App\Models\ResourceSet::query()
                    ->with('items')
                    ->whereKey($data['resource_set_id'])
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($data['location_id'] && (int) $set->location_id !== (int) $data['location_id']) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'resource_set_id' => 'The selected set is not available at this location.',
                    ]);
                }

                $reservedSets = Distribution::query()
                    ->where('resource_set_id', $set->id)
                    ->whereIn('status', ['pending', 'in_transit'])
                    ->where('excluded', false)
                    ->count();
                $availableSets = max(0, (int) ($set->sets_remaining ?? $set->num_sets ?? 0) - $reservedSets);

                if ($availableSets < $families->count()) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'resource_set_id' => "Only {$availableSets} sets are available, but {$families->count()} active families are scheduled.",
                    ]);
                }

                $firstResourceId = $set->items->first()?->resource_id;
                if (! $firstResourceId || (int) $data['resource_id'] !== (int) $firstResourceId) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'resource_id' => 'The schedule resource does not match the selected set.',
                    ]);
                }
            } else {
                $resource = Resource::query()
                    ->whereKey($data['resource_id'])
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($data['location_id'] && (int) $resource->location_id !== (int) $data['location_id']) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'resource_id' => 'The selected resource is not available at this location.',
                    ]);
                }

                $requiredQuantity = $families->sum(
                    fn (Family $family) => max(1, (int) ceil(max(1, (int) $family->household_member) / 3))
                );
                $reservedQuantity = $this->getReservedResourceQuantities()[$resource->id] ?? 0;
                $availableQuantity = max(0, (int) $resource->quantity - $reservedQuantity);

                if ($availableQuantity < $requiredQuantity) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'resource_id' => "Only {$availableQuantity} {$resource->unit} are available, but {$requiredQuantity} are required for this schedule.",
                    ]);
                }
            }

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

            $families->each(function (Family $family) use (
                    $request,
                    $data,
                    $scheduledAt,
                    $scheduleId
                ) {
                    $dist = Distribution::create([
                        'family_id'       => $family->id,
                        'resource_id'     => $data['resource_id'],
                        'resource_set_id' => ($data['assignment_mode'] ?? null) === 'set' ? ($data['resource_set_id'] ?? null) : null,
                        'assignment_mode' => $data['assignment_mode'] ?? null,
                        'quantity'        => max(1, (int) ceil(max(1, (int) $family->household_member) / 3)),
                        'additional_resource_id' => null,
                        'additional_quantity'    => null,
                        'location_id'     => $family->location_id,
                        'distribution_date' => $scheduledAt,
                        'recipient_name'  => $family->head_name,
                        'recipient_contact' => $family->phone,
                        'household_member' => $family->household_member,
                        'distributed_by'  => $request->user()->id,
                        'status'          => 'pending',
                        'notes'           => null,
                        'schedule_id'     => $scheduleId,
                    ]);

                    if (($data['assignment_mode'] ?? null) === 'individual' && !empty($data['items'])) {
                        foreach ($data['items'] as $item) {
                            $dist->items()->create([
                                'resource_id' => $item['resource_id'],
                                'quantity'    => (int) $item['quantity'],
                            ]);
                        }
                    }
                });
        });

        return redirect()
            ->route('distribution.index')
            ->with(
                'success',
                'New relief distribution schedule added for all registered families.'
            );
    }

    public function cancelSchedule(Request $request, int $scheduleId): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $cancelledCount = DB::transaction(function () use ($scheduleId) {
            $schedule = DB::table('distribution_schedules')
                ->where('id', $scheduleId)
                ->lockForUpdate()
                ->first();
            abort_unless($schedule, 404);

            $cancelledCount = Distribution::query()
                ->where('schedule_id', $scheduleId)
                ->whereIn('status', ['pending', 'in_transit'])
                ->update(['status' => 'cancelled', 'updated_at' => now()]);

            DB::table('distribution_schedules')
                ->where('id', $scheduleId)
                ->update(['cancelled_at' => now(), 'updated_at' => now()]);

            return $cancelledCount;
        });

        if ($cancelledCount === 0) {
            return back()->withErrors([
                'schedule' => 'This schedule has no pending distributions to cancel.',
            ]);
        }

        return back()->with('success', "Schedule cancelled. {$cancelledCount} pending distribution(s) were cancelled.");
    }

    public function destroySchedule(Request $request, int $scheduleId): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $deleted = DB::transaction(function () use ($scheduleId) {
            $schedule = DB::table('distribution_schedules')
                ->where('id', $scheduleId)
                ->lockForUpdate()
                ->first();
            abort_unless($schedule, 404);

            $hasCompleted = Distribution::query()
                ->where('schedule_id', $scheduleId)
                ->where('status', 'completed')
                ->exists();

            if ($hasCompleted) {
                return false;
            }

            Distribution::query()->where('schedule_id', $scheduleId)->delete();
            DB::table('distribution_schedules')->where('id', $scheduleId)->delete();

            return true;
        });

        if (! $deleted) {
            return back()->withErrors([
                'schedule' => 'A schedule with completed distributions cannot be deleted. Cancel its remaining distributions instead.',
            ]);
        }

        return back()->with('success', 'Schedule and its distributions deleted successfully.');
    }

    public function checkStock(Request $request): \Illuminate\Http\JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $data = $request->validate([
            'assignment_mode'     => ['required', 'in:set,individual'],
            'resource_set_id'     => ['required_if:assignment_mode,set', 'nullable', 'exists:resource_sets,id'],
            'items'               => ['nullable', 'array'],
            'items.*.resource_id' => ['required_with:items', 'exists:resources,id'],
            'items.*.quantity'    => ['required_with:items', 'integer', 'min:1'],
            'location_id'         => ['nullable', 'exists:locations,id'],
            'distribution_id'     => ['nullable', 'exists:distributions,id'],
        ]);

        $warnings = [];

        if ($data['assignment_mode'] === 'set') {
            $set = \App\Models\ResourceSet::query()->findOrFail($data['resource_set_id']);
            $reservedSets = Distribution::query()
                ->where('resource_set_id', $set->id)
                ->whereIn('status', ['pending', 'in_transit'])
                ->where('excluded', false)
                ->when($data['distribution_id'] ?? null, fn ($query) => $query->whereKeyNot($data['distribution_id']))
                ->count();
            $availableSets = max(0, (int) ($set->sets_remaining ?? $set->num_sets ?? 0) - $reservedSets);

            if ($availableSets < 1) {
                $warnings[] = [
                    'resource_id' => $set->id,
                    'resource_name' => $set->name,
                    'unit' => 'sets',
                    'available' => $availableSets,
                    'required' => 1,
                    'shortfall' => 1 - $availableSets,
                ];
            }
        } elseif (! empty($data['items'])) {
            $reservedQuantities = $this->getReservedResourceQuantities(
                isset($data['distribution_id']) ? (int) $data['distribution_id'] : null
            );

            foreach ($data['items'] as $item) {
                $resource = Resource::find($item['resource_id']);
                if ($resource) {
                    $required = (int) $item['quantity'];
                    $available = max(0, (int) $resource->quantity - ($reservedQuantities[$resource->id] ?? 0));

                    if ($available < $required) {
                        $warnings[] = [
                            'resource_id' => $resource->id,
                            'resource_name' => $resource->name,
                            'unit' => $resource->unit,
                            'available' => $available,
                            'required' => $required,
                            'shortfall' => $required - $available,
                        ];
                    }
                }
            }
        }

        return response()->json(['warnings' => $warnings]);
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
            'assignment_mode'     => ['nullable', 'in:set,individual'],
            'resource_set_id'     => ['nullable', 'exists:resource_sets,id'],
            'items'               => ['nullable', 'array'],
            'items.*.resource_id' => ['required_with:items', 'exists:resources,id'],
            'items.*.quantity'    => ['required_with:items', 'integer', 'min:1'],
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
     * Count active families that are not excluded on any pending distribution.
     * Optionally scoped to a specific location.
     */
    private function getNonExcludedFamilyCount(?int $locationId = null): int
    {
        return \App\Models\Family::query()
            ->where('status', 'active')
            ->when($locationId, fn($q) => $q->where('location_id', $locationId))
            ->whereDoesntHave('distributions', function ($q) {
                $q->where('excluded', true)
                  ->where('status', 'pending');
            })
            ->count();
    }

    /**
     * Quantities reserved by pending or in-transit distributions.
     *
     * Completed distributions have already deducted stock. Resource-set
     * contents are not counted here because their stock was deducted when
     * the set was produced; their remaining set count is reserved separately.
     *
     * @return array<int, int>
     */
    private function getReservedResourceQuantities(?int $exceptDistributionId = null): array
    {
        $reservations = [];

        Distribution::query()
            ->with('items:id,distribution_id,resource_id,quantity')
            ->whereIn('status', ['pending', 'in_transit'])
            ->where('excluded', false)
            ->when($exceptDistributionId, fn ($query) => $query->whereKeyNot($exceptDistributionId))
            ->get([
                'id',
                'resource_id',
                'resource_set_id',
                'additional_resource_id',
                'quantity',
                'additional_quantity',
            ])
            ->each(function (Distribution $distribution) use (&$reservations) {
                if (! $distribution->resource_set_id) {
                    if ($distribution->items->isEmpty() && $distribution->resource_id) {
                        $reservations[$distribution->resource_id] =
                            ($reservations[$distribution->resource_id] ?? 0) + (int) $distribution->quantity;
                    }

                    foreach ($distribution->items as $item) {
                        $reservations[$item->resource_id] =
                            ($reservations[$item->resource_id] ?? 0) + (int) $item->quantity;
                    }

                    if ($distribution->additional_resource_id) {
                        $reservations[$distribution->additional_resource_id] =
                            ($reservations[$distribution->additional_resource_id] ?? 0)
                            + (int) $distribution->additional_quantity;
                    }
                }
            });

        return $reservations;
    }

    /**
     * Prevent manual distributions from consuming stock reserved elsewhere.
     */
    private function assertDistributionStockAvailable(array $data, ?int $exceptDistributionId = null): void
    {
        if (in_array($data['status'] ?? 'pending', ['cancelled'], true)) {
            return;
        }

        if (($data['assignment_mode'] ?? null) === 'set') {
            if (empty($data['resource_set_id'])) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'resource_set_id' => 'Select a resource set before saving this distribution.',
                ]);
            }

            $set = \App\Models\ResourceSet::query()
                ->whereKey($data['resource_set_id'])
                ->lockForUpdate()
                ->firstOrFail();
            $reservedSets = Distribution::query()
                ->where('resource_set_id', $set->id)
                ->whereIn('status', ['pending', 'in_transit'])
                ->where('excluded', false)
                ->when($exceptDistributionId, fn ($query) => $query->whereKeyNot($exceptDistributionId))
                ->count();
            $availableSets = max(0, (int) ($set->sets_remaining ?? $set->num_sets ?? 0) - $reservedSets);

            if ($availableSets < 1) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'resource_set_id' => "No unreserved sets remain for {$set->name}.",
                ]);
            }

            return;
        }

        $requiredByResource = [];
        $items = $data['items'] ?? [];

        if (($data['assignment_mode'] ?? null) === 'individual' && ! empty($items)) {
            foreach ($items as $item) {
                if (! empty($item['resource_id'])) {
                    $resourceId = (int) $item['resource_id'];
                    $requiredByResource[$resourceId] =
                        ($requiredByResource[$resourceId] ?? 0) + (int) ($item['quantity'] ?? 0);
                }
            }
        } elseif (! empty($data['resource_id'])) {
            $resourceId = (int) $data['resource_id'];
            $requiredByResource[$resourceId] =
                ($requiredByResource[$resourceId] ?? 0) + (int) ($data['quantity'] ?? 0);
        }

        if (! empty($data['additional_resource_id'])) {
            $resourceId = (int) $data['additional_resource_id'];
            $requiredByResource[$resourceId] =
                ($requiredByResource[$resourceId] ?? 0) + (int) ($data['additional_quantity'] ?? 0);
        }

        if ($requiredByResource === []) {
            return;
        }

        ksort($requiredByResource);
        $resources = Resource::query()
            ->whereIn('id', array_keys($requiredByResource))
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
        $reserved = $this->getReservedResourceQuantities($exceptDistributionId);

        foreach ($requiredByResource as $resourceId => $required) {
            $resource = $resources->get($resourceId);
            $available = $resource
                ? max(0, (int) $resource->quantity - ($reserved[$resourceId] ?? 0))
                : 0;

            if (! $resource || $available < $required) {
                $name = $resource?->name ?? "Resource #{$resourceId}";
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'items' => "{$name}: {$available} available, {$required} required after existing reservations.",
                ]);
            }
        }
    }

    /**
     * Build stock warnings for a saved distribution.
     * Returns an array of warning objects (empty array if no shortfalls).
     */
    private function calculateStockWarnings(Distribution $distribution): array
    {
        $nonExcludedCount = $this->getNonExcludedFamilyCount($distribution->location_id);

        $itemsToCheck = [];

        if ($distribution->resource_set_id) {
            $set = \App\Models\ResourceSet::with('items.resource:id,name,unit,quantity')
                ->find($distribution->resource_set_id);
            if ($set) {
                foreach ($set->items as $item) {
                    $itemsToCheck[] = ['resource' => $item->resource, 'quantity' => $item->quantity];
                }
            }
        } else {
            $distribution->loadMissing('items');
            foreach ($distribution->items as $item) {
                $resource = \App\Models\Resource::find($item->resource_id);
                if ($resource) {
                    $itemsToCheck[] = ['resource' => $resource, 'quantity' => $item->quantity];
                }
            }
        }

        $warnings = [];

        foreach ($itemsToCheck as $check) {
            $required  = $check['quantity'] * $nonExcludedCount;
            $available = $check['resource']->quantity ?? 0;

            if ($available < $required) {
                $warnings[] = [
                    'resource_id'   => $check['resource']->id,
                    'resource_name' => $check['resource']->name,
                    'unit'          => $check['resource']->unit,
                    'available'     => $available,
                    'required'      => $required,
                    'shortfall'     => $required - $available,
                ];
            }
        }

        return $warnings;
    }

    /**
     * Exclude a family from a distribution schedule.
     */
    public function exclude(Request $request, Distribution $distribution): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        if ($distribution->status === 'completed') {
            return back()->withErrors([
                'exclude' => 'Cannot exclude a distribution that is already completed.',
            ]);
        }

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $distribution->update([
            'excluded'         => true,
            'exclusion_reason' => $data['reason'] ?? null,
        ]);

        return back()->with('success', 'Family excluded from this distribution schedule.');
    }

    /**
     * Re-include a previously excluded family in a distribution schedule.
     */
    public function include(Request $request, Distribution $distribution): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $distribution->update([
            'excluded'         => false,
            'exclusion_reason' => null,
        ]);

        return back()->with('success', 'Family re-included in this distribution schedule.');
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
                'family:id,family_id,head_name,household_member,purok_id',
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