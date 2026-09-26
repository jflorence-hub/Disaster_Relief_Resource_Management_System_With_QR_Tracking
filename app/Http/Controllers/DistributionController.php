<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Models\Location;
use App\Models\Resource;
use App\Models\Family;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\JsonResponse;

class DistributionController extends Controller
{
    public function index(Request $request): Response
    {
        $distributions = Distribution::query()
            ->with([
                'family:id,family_id,family_name,head_name,phone,beneficiary_count,purok_id',
                'resource:id,name,unit,category',
                'additionalResource:id,name,unit,category',
                'location:id,name',
                'distributor:id,name',
            ])
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->toString();

                $query->where(function ($q) use ($search) {
                    $q->where('recipient_name', 'like', "%{$search}%")
                        ->orWhere('recipient_contact', 'like', "%{$search}%")
                        ->orWhereHas('family', function ($familyQuery) use ($search) {
                            $familyQuery
                                ->where('family_name', 'like', "%{$search}%")
                                ->orWhere('family_id', 'like', "%{$search}%");
                        });
                });
            })
            ->when($request->filled('status'), function ($query) use ($request) {
                $query->where(
                    'status',
                    $request->string('status')->toString()
                );
            })
            ->orderByDesc('distribution_date')
            ->get();

        // Active families from Families page
        $families = Family::query()
            ->with('purok:id,name')
            ->where('status', 'active')
            ->orderBy('family_name')
            ->get([
                'id',
                'family_id',
                'family_name',
                'head_name',
                'phone',
                'beneficiary_count',
                'address',
                'purok_id',
                'status',
            ]);

        // Staff and their assigned Purok
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

            'resources' => Resource::query()
                ->orderBy('name')
                ->get([
                    'id',
                    'name',
                    'category',
                    'unit',
                    'quantity',
                ]),

            'locations' => Location::query()
                ->orderBy('name')
                ->get([
                    'id',
                    'name',
                ]),

            'families' => $families,

            'staff' => $staff,

            'filters' => $request->only([
                'search',
                'status',
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        DB::transaction(function () use ($data, $request) {

            /*
            |--------------------------------------------------------------------------
            | Get selected family
            |--------------------------------------------------------------------------
            */

            $family = Family::findOrFail($data['family_id']);

            /*
            |--------------------------------------------------------------------------
            | Staff can only distribute to families in their Purok
            |--------------------------------------------------------------------------
            */

            if (
                $request->user()?->role === 'staff' &&
                (int) $family->purok_id !== (int) $request->user()->purok_id
            ) {
                abort(403, 'You cannot distribute to a family outside your Purok.');
            }

            /*
            |--------------------------------------------------------------------------
            | Automatically get family information
            |--------------------------------------------------------------------------
            */

            $data['recipient_name'] = $family->family_name;
            $data['recipient_contact'] = $family->phone;

            /*
            |--------------------------------------------------------------------------
            | Automatically use beneficiary count from Families
            |--------------------------------------------------------------------------
            */

            $data['beneficiary_count'] = $family->beneficiary_count;

            /*
            |--------------------------------------------------------------------------
            | Default quantity
            |--------------------------------------------------------------------------
            */

            $data['quantity'] = $data['quantity'] ?? 1;

            /*
            |--------------------------------------------------------------------------
            | Distributor
            |--------------------------------------------------------------------------
            */

            $data['distributed_by'] = $request->user()?->id;

            $distribution = Distribution::create($data);

            if ($distribution->status === 'completed') {
                $distribution->applyStock();
            }
        });

        return back()->with(
            'success',
            'Distribution recorded successfully.'
        );
    }

    public function update(
        Request $request,
        Distribution $distribution
    ): RedirectResponse {
        $data = $this->validated($request);

        DB::transaction(function () use ($data, $request, $distribution) {

            /*
            |--------------------------------------------------------------------------
            | Reverse previous stock if needed
            |--------------------------------------------------------------------------
            */

            if ($distribution->status === 'completed') {
                $distribution->reverseStock();
            }

            /*
            |--------------------------------------------------------------------------
            | Get family
            |--------------------------------------------------------------------------
            */

            $family = Family::findOrFail($data['family_id']);

            /*
            |--------------------------------------------------------------------------
            | Staff restriction
            |--------------------------------------------------------------------------
            */

            if (
                $request->user()?->role === 'staff' &&
                (int) $family->purok_id !== (int) $request->user()->purok_id
            ) {
                abort(
                    403,
                    'You cannot distribute to a family outside your Purok.'
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Automatically get family information
            |--------------------------------------------------------------------------
            */

            $data['recipient_name'] = $family->family_name;
            $data['recipient_contact'] = $family->phone;

            /*
            |--------------------------------------------------------------------------
            | Automatically get beneficiary count
            |--------------------------------------------------------------------------
            */

            $data['beneficiary_count'] = $family->beneficiary_count;

            /*
            |--------------------------------------------------------------------------
            | Default quantity
            |--------------------------------------------------------------------------
            */

            $data['quantity'] = $data['quantity'] ?? 1;

            $distribution->update($data);

            if ($distribution->status === 'completed') {
                $distribution->applyStock();
            }
        });

        return back()->with(
            'success',
            'Distribution updated successfully.'
        );
    }

    public function destroy(
        Distribution $distribution
    ): RedirectResponse {

        DB::transaction(function () use ($distribution) {

            if ($distribution->status === 'completed') {
                $distribution->reverseStock();
            }

            $distribution->delete();
        });

        return back()->with(
            'success',
            'Distribution deleted successfully.'
        );
    }

    private function validated(Request $request): array
    {
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
                'nullable',
                'integer',
                'min:1',
            ],

            'additional_quantity' => [
                'nullable',
                'required_with:additional_resource_id',
                'integer',
                'min:1',
            ],

            /*
             * These are now automatically generated
             * from the selected family.
             */
            'recipient_name' => [
                'nullable',
                'string',
                'max:255',
            ],

            'recipient_contact' => [
                'nullable',
                'string',
                'max:255',
            ],

            'beneficiary_count' => [
                'nullable',
                'integer',
                'min:1',
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

    public function history(): JsonResponse
    {
        $history = Distribution::query()
            ->with([
                'family:id,family_id,family_name,head_name,beneficiary_count,purok_id',
                'resource:id,name,unit',
                'additionalResource:id,name,unit',
                'location:id,name',
                'distributor:id,name',
            ])
            ->orderByDesc('distribution_date')
            ->get();

        return response()->json($history);
    }
}