<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\Distribution;
use App\Models\Purok;
use App\Models\Resource;
use App\Models\User;
use App\Models\Location;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class FamilyController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $families = Family::query()
            ->with([
                'purok:id,name',
                'location:id,name,status',
            ])
            ->when(
                $user->role === 'staff',
                fn($query) =>
                    $query->where(
                        'purok_id',
                        $user->purok_id
                    )
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
                                'family_name',
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
                            );
                    });
                }
            )
            ->orderBy('family_name')
            ->get();

        $puroks = Purok::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'code',
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
            ->whereNotNull('purok_id')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'purok_id',
            ]);

        return Inertia::render('families', [
            'families' => $families,
            'puroks' => $puroks,
            'locations' => $locations,
            'staff' => $staff,
            'filters' => $request->only([
                'search',
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'family_id' => [
                'required',
                'string',
                'max:50',
                'unique:families,family_id',
            ],

            'family_name' => [
                'required',
                'string',
                'max:255',
            ],

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
        ]);

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
            $this->syncHousehold_member($family);

            /*
             * Find default resource.
             */
            $defaultResource =
                Resource::query()
                    ->where(
                        'name',
                        'Set of Goods and Needs'
                    )
                    ->first();

            if (!$defaultResource) {
                throw new \RuntimeException(
                    'The resource "Set of Goods and Needs" was not found. Please create this resource first.'
                );
            }

            /*
             * Create REAL distribution record.
             */
            Distribution::create([
                'family_id' =>
                    $family->id,

                'resource_id' =>
                    $defaultResource->id,

                'quantity' => 1,

                'additional_resource_id' =>
                    null,

                'additional_quantity' =>
                    null,

                /*
                 * Use the family's location.
                 */
                'location_id' =>
                    $family->location_id,

                'distributed_by' =>
                    $user->id,

                'recipient_name' =>
                    $family->family_name,

                'recipient_contact' =>
                    $family->phone,

                'household_member' =>
                    $family->household_member,

                'distribution_date' =>
                    now(),

                'status' => 'pending',

                'notes' => null,
            ]);
        });

        return back()->with(
            'success',
            'Family added successfully and initial distribution created.'
        );
    }

    /**
     * Create beneficiary records.
     */
    private function syncHousehold_member(
        Family $family
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
                    'household_member_number' =>
                        $i,
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
        $user = $request->user();

        if (
            $user->role === 'staff' &&
            (int) $family->purok_id !==
            (int) $user->purok_id
        ) {
            abort(403);
        }

        $data = $request->validate([
            'family_id' => [
                'required',
                'string',
                'max:50',
                'unique:families,family_id,' .
                $family->id,
            ],

            'family_name' => [
                'required',
                'string',
                'max:255',
            ],

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
            $this->syncHousehold_member($family);

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
                            $family->family_name,

                        'recipient_contact' =>
                            $family->phone,

                        'household_member' =>
                            $family->household_member,
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