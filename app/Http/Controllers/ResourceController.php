<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\Resource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ResourceController extends Controller
{
    public function index(Request $request): Response
    {
        /*
         * Main Warehouse is the default location.
         */
        $mainWarehouse = Location::whereRaw(
            'LOWER(name) = ?',
            ['main warehouse']
        )->first();

        /*
         * If no location_id is provided,
         * automatically use Main Warehouse.
         */
        $selectedLocationId = $request->filled('location_id')
            ? $request->input('location_id')
            : $mainWarehouse?->id;

        $resources = Resource::query()
            ->with('location:id,name,city')

            /*
             * Search
             */
            ->when(
                $request->string('search')->toString(),
                function ($query, $search) {
                    $query->where(function ($q) use ($search) {
                        $q->where(
                            'name',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'sku',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'qr_code',
                            'like',
                            "%{$search}%"
                        );
                    });
                }
            )

            /*
             * Category filter
             */
            ->when(
                $request->string('category')->toString(),
                fn ($query, $category) =>
                    $query->where(
                        'category',
                        $category
                    )
            )

            /*
             * Location filter
             *
             * Main Warehouse is automatically used
             * when the page is first opened.
             */
            ->when(
                $selectedLocationId !== null,
                fn ($query) =>
                    $query->where(
                        'location_id',
                        $selectedLocationId
                    )
            )

            ->orderBy('name')
            ->get();

        return Inertia::render('resources', [
            'resources' => $resources,

            'locations' => Location::select(
                'id',
                'name'
            )
                ->orderBy('name')
                ->get(),

            /*
             * Send the actual selected location
             * back to the React page.
             */
            'filters' => [
                'search' => $request->input('search'),
                'category' => $request->input('category'),
                'location_id' => $selectedLocationId,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        /*
         * Find Main Warehouse.
         */
        $mainWarehouse = Location::whereRaw(
            'LOWER(name) = ?',
            ['main warehouse']
        )->first();

        /*
         * Prevent creating resources if Main Warehouse
         * does not exist.
         */
        if (!$mainWarehouse) {
            return back()->withErrors([
                'location_id' =>
                    'Main Warehouse location does not exist.'
            ]);
        }

        $data = $this->validated($request);

        /*
         * IMPORTANT:
         *
         * New resources ALWAYS go to Main Warehouse.
         *
         * Even if the frontend sends another location_id,
         * it will be replaced here.
         */
        $data['location_id'] = $mainWarehouse->id;

        Resource::create($data);

        return back()->with(
            'success',
            'Resource created successfully in Main Warehouse.'
        );
    }

    public function update(
        Request $request,
        Resource $resource
    ): RedirectResponse {
        $data = $this->validated(
            $request,
            $resource
        );

        /*
         * Do not allow the Resources page to move
         * resources between locations.
         *
         * Location changes must happen through
         * QR Tracking.
         */
        unset($data['location_id']);

        $resource->update($data);

        return back()->with(
            'success',
            'Resource updated successfully.'
        );
    }

    public function destroy(
        Resource $resource
    ): RedirectResponse {
        $resource->delete();

        return back()->with(
            'success',
            'Resource deleted successfully.'
        );
    }

    private function validated(
        Request $request,
        ?Resource $resource = null
    ): array {
        return $request->validate([
            'name' => 'required|string|max:255',

            'category' =>
                'required|in:food,water,medical,shelter,clothing,hygiene,tools,set,other',

            'sku' =>
                'nullable|string|max:100|unique:resources,sku' .
                ($resource
                    ? ",{$resource->id}"
                    : ''),

            'quantity' =>
                'required|integer|min:0',

            'unit' =>
                'required|string|max:50',

            'minimum_threshold' =>
                'required|integer|min:0',

            'expiry_date' =>
                'nullable|date',

            'location_id' =>
                'nullable|exists:locations,id',

            'notes' =>
                'nullable|string',
        ]);
    }
}