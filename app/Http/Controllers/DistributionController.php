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

        // ============================================================
        // DISTRIBUTIONS
        // ============================================================

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
                function ($query) use ($user) {
                    $query->whereHas(
                        'family',
                        function ($familyQuery) use ($user) {
                            $familyQuery->where(
                                'purok_id',
                                $user->purok_id
                            );
                        }
                    );
                }
            )
            ->when(
                $request->filled('search'),
                function ($query) use ($request) {
                    $search = $request->input('search');

                    $query->where(function ($q) use ($search) {
                        $q->where(
                            'recipient_name',
                            'like',
                            "%{$search}%"
                        )
                            ->orWhere(
                                'recipient_contact',
                                'like',
                                "%{$search}%"
                            )
                            ->orWhereHas(
                                'family',
                                function ($familyQuery) use ($search) {
                                    $familyQuery
                                        ->where(
                                            'family_id',
                                            'like',
                                            "%{$search}%"
                                        )
                                        ->orWhere(
                                            'family_name',
                                            'like',
                                            "%{$search}%"
                                        )
                                        ->orWhere(
                                            'head_name',
                                            'like',
                                            "%{$search}%"
                                        );
                                }
                            );
                    });
                }
            )
            ->when(
                $request->filled('status'),
                function ($query) use ($request) {
                    $query->where(
                        'status',
                        $request->input('status')
                    );
                }
            )
            ->orderByDesc('distribution_date')
            ->get();

        // ============================================================
        // ACTIVE FAMILIES
        // ============================================================

        $families = Family::query()
            ->with('purok:id,name')
            ->where('status', 'active')
            ->when(
                $user->role === 'staff',
                function ($query) use ($user) {
                    $query->where(
                        'purok_id',
                        $user->purok_id
                    );
                }
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

        // ============================================================
        // RESOURCES
        // ============================================================

        $resources = Resource::query()
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'unit',
                'category',
                'quantity',
            ]);

        // ============================================================
        // LOCATIONS
        // ============================================================

        $locations = Location::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get([
                'id',
                'name',
            ]);

        // ============================================================
// STAFF
// ============================================================

        $staff = User::query()
            ->where('role', 'staff')
            ->whereNotNull('purok_id')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'purok_id',
            ]);

        return Inertia::render('distribution', [
            'distributions' => $distributions,
            'resources' => $resources,
            'locations' => $locations,
            'families' => $families,
            'staff' => $staff,
            'filters' => $request->only([
                'search',
                'status',
            ]),
            'currentDate' => now()->format('Y-m-d'),
            'defaultSetResource' => Resource::query()
                ->where('name', 'Set of Goods and Needs')
                ->first([
                    'id',
                    'name',
                    'category',
                    'unit',
                    'quantity',
                ]),
        ]);

        // ============================================================
        // DEFAULT SET RESOURCE
        // ============================================================

        $defaultSetResource = Resource::query()
            ->where('name', 'Set of Goods and Needs')
            ->first([
                'id',
                'name',
                'category',
                'unit',
                'quantity',
            ]);

        // ============================================================
        // RETURN PAGE
        // ============================================================

        return Inertia::render('distribution', [
            'distributions' => $distributions,
            'resources' => $resources,
            'locations' => $locations,
            'families' => $families,
            'staff' => $staff,

            'filters' => $request->only([
                'search',
                'status',
            ]),

            'currentDate' => now()->format('Y-m-d'),

            'defaultSetResource' => $defaultSetResource,
        ]);
    }

    /**
     * Manually create a distribution.
     *
     * Family registration already creates
     * the initial distribution automatically.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateDistribution($request);

        $family = Family::findOrFail(
            $data['family_id']
        );

        // Check staff access.
        $this->checkStaffAccess(
            $request,
            $family
        );

        // ============================================================
        // RECIPIENT INFORMATION
        // ============================================================

        $data['recipient_name'] =
            $family->family_name;

        $data['recipient_contact'] =
            $family->phone;

        $data['household_member'] =
            $family->household_member;

        $data['distributed_by'] =
            $request->user()->id;

        $data['quantity'] =
            (int) $data['quantity'];

        // ============================================================
        // CREATE
        // ============================================================

        $distribution = Distribution::create($data);

        // Only completed distributions consume stock.
        if ($distribution->status === 'completed') {
            $distribution->applyStock();
        }

        return redirect()
            ->route('distribution.index')
            ->with(
                'success',
                'Distribution saved successfully.'
            );
    }

    /**
     * Update an existing distribution.
     */
    public function update(
        Request $request,
        Distribution $distribution
    ): RedirectResponse {

        $data = $request->validate([
            'family_id' => [
                'required',
                'exists:families,id',
            ],

            'resource_id' => [
                'required',
                'exists:resources,id',
            ],

            'quantity' => [
                'required',
                'integer',
                'min:1',
            ],

            'additional_resource_id' => [
                'nullable',
                'exists:resources,id',
                'different:resource_id',
            ],

            'additional_quantity' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'location_id' => [
                'nullable',
                'exists:locations,id',
            ],

            'distribution_date' => [
                'required',
                'date',
            ],

            'status' => [
                'required',
                'in:pending,in_transit,completed,cancelled',
            ],

            'notes' => [
                'nullable',
                'string',
            ],
        ]);

        $family = Family::findOrFail(
            $data['family_id']
        );

        $this->checkStaffAccess(
            $request,
            $family
        );

        DB::transaction(function () use ($distribution, $data, $family) {

            /*
            |--------------------------------------------------------------------------
            | Restore old stock
            |--------------------------------------------------------------------------
            */

            if ($distribution->status === 'completed') {
                $distribution->reverseStock();
            }

            /*
            |--------------------------------------------------------------------------
            | Family
            |--------------------------------------------------------------------------
            */

            $distribution->family_id =
                $family->id;

            $distribution->recipient_name =
                $family->family_name;

            $distribution->recipient_contact =
                $family->phone;

            $distribution->household_member =
                $family->household_member;

            /*
            |--------------------------------------------------------------------------
            | Main resource
            |--------------------------------------------------------------------------
            */

            $distribution->resource_id =
                $data['resource_id'];

            $distribution->quantity =
                (int) $data['quantity'];

            /*
            |--------------------------------------------------------------------------
            | Additional resource
            |--------------------------------------------------------------------------
            */

            $distribution->additional_resource_id =
                $data['additional_resource_id']
                ?? null;

            $distribution->additional_quantity =
                !empty($data['additional_resource_id'])
                ? (int) ($data['additional_quantity'] ?? 1)
                : null;

            /*
            |--------------------------------------------------------------------------
            | Location
            |--------------------------------------------------------------------------
            */

            $distribution->location_id =
                $data['location_id']
                ?? null;

            /*
            |--------------------------------------------------------------------------
            | Other fields
            |--------------------------------------------------------------------------
            */

            $distribution->distribution_date =
                $data['distribution_date'];

            $distribution->status =
                $data['status'];

            $distribution->notes =
                $data['notes'] ?? null;

            /*
            |--------------------------------------------------------------------------
            | Save
            |--------------------------------------------------------------------------
            */

            $distribution->save();

            /*
            |--------------------------------------------------------------------------
            | Apply new stock
            |--------------------------------------------------------------------------
            */

            if ($distribution->status === 'completed') {
                $distribution->applyStock();
            }
        });

        return redirect()
            ->route('distribution.index')
            ->with(
                'success',
                'Distribution updated successfully.'
            );
    }

    /**
     * Delete a distribution.
     */
    public function destroy(
        Request $request,
        Distribution $distribution
    ): RedirectResponse {
        // ============================================================
        // STAFF ACCESS CHECK
        // ============================================================

        $distribution->load('family');

        if ($distribution->family) {
            $this->checkStaffAccess(
                $request,
                $distribution->family
            );
        }

        // ============================================================
        // DELETE
        // ============================================================

        DB::transaction(function () use ($distribution) {
            $lockedDistribution = Distribution::query()
                ->whereKey($distribution->id)
                ->lockForUpdate()
                ->firstOrFail();

            // Restore stock if completed.
            if (
                $lockedDistribution->status ===
                'completed'
            ) {
                $lockedDistribution->reverseStock();
            }

            $lockedDistribution->delete();
        });

        return redirect()
            ->route('distribution.index')
            ->with(
                'success',
                'Distribution deleted successfully.'
            );
    }

    /**
     * Validate distribution input.
     */
    private function validateDistribution(
        Request $request
    ): array {

        return $request->validate([

            'family_id' => [
                'required',
                'exists:families,id',
            ],

            'resource_id' => [
                'required',
                'exists:resources,id',
            ],

            'additional_resource_id' => [
                'nullable',
                'exists:resources,id',
                'different:resource_id',
            ],

            'location_id' => [
                'nullable',
                'exists:locations,id',
            ],

            'quantity' => [
                'required',
                'integer',
                'min:1',
            ],

            'additional_quantity' => [
                'nullable',
                'integer',
                'min:1',
                'required_with:additional_resource_id',
            ],

            'distribution_date' => [
                'required',
                'date',
            ],

            'status' => [
                'required',
                'in:pending,in_transit,completed,cancelled',
            ],

            'notes' => [
                'nullable',
                'string',
            ],
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
            $user?->role === 'staff' &&
            (int) $family->purok_id !==
            (int) $user->purok_id
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
                function ($query) use ($user) {
                    $query->whereHas(
                        'family',
                        function ($familyQuery) use ($user) {
                            $familyQuery->where(
                                'purok_id',
                                $user->purok_id
                            );
                        }
                    );
                }
            )
            ->orderByDesc('distribution_date')
            ->get();

        return response()->json($history);
    }
}