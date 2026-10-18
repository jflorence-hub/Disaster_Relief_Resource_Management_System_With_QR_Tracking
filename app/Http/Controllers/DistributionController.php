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
            'resourceSets' => \App\Models\ResourceSet::query()
                ->with(['items.resource:id,name,unit', 'location:id,name'])
                ->orderBy('name')
                ->get(),
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
            'items.*.resource_id' => ['nullable', 'exists:resources,id'],
            'items.*.quantity'    => ['nullable', 'integer', 'min:1'],
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
            'assignment_mode'     => ['nullable', 'in:set,individual'],
            'resource_set_id'     => ['nullable', 'exists:resource_sets,id'],
            'items'               => ['nullable', 'array'],
            'items.*.resource_id' => ['nullable', 'exists:resources,id'],
            'items.*.quantity'    => ['nullable', 'integer', 'min:1'],
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

    public function checkStock(Request $request): \Illuminate\Http\JsonResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $data = $request->validate([
            'assignment_mode'     => ['required', 'in:set,individual'],
            'resource_set_id'     => ['nullable', 'exists:resource_sets,id'],
            'items'               => ['nullable', 'array'],
            'items.*.resource_id' => ['required_with:items', 'exists:resources,id'],
            'items.*.quantity'    => ['required_with:items', 'integer', 'min:1'],
            'location_id'         => ['nullable', 'exists:locations,id'],
        ]);

        $nonExcludedCount = $this->getNonExcludedFamilyCount(
            isset($data['location_id']) ? (int) $data['location_id'] : null
        );

        $itemsToCheck = [];

        if ($data['assignment_mode'] === 'set' && !empty($data['resource_set_id'])) {
            $set = \App\Models\ResourceSet::with('items.resource:id,name,unit,quantity')
                ->find($data['resource_set_id']);

            if ($set) {
                foreach ($set->items as $setItem) {
                    $itemsToCheck[] = [
                        'resource' => $setItem->resource,
                        'quantity' => $setItem->quantity,
                    ];
                }
            }
        } elseif ($data['assignment_mode'] === 'individual' && !empty($data['items'])) {
            foreach ($data['items'] as $item) {
                $resource = Resource::find($item['resource_id']);
                if ($resource) {
                    $itemsToCheck[] = [
                        'resource' => $resource,
                        'quantity' => $item['quantity'],
                    ];
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
            'items.*.resource_id' => ['nullable', 'exists:resources,id'],
            'items.*.quantity'    => ['nullable', 'integer', 'min:1'],
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