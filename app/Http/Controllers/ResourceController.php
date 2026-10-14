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
    /**
     * Canonical list of disaster types used across the app.
     * Keep this in sync with DISASTER_TYPES in resources.tsx.
     */
    public const DISASTER_TYPES = [
        'Typhoon',
        'Flood',
        'Earthquake',
        'Volcanic Eruption',
        'Landslide',
        'Tsunami',
        'Storm Surge',
        'Drought',
        'Wildfire',
        'Tornado',
        'Hurricane',
        'Cyclone',
        'Flash Flood',
        'Mudslide',
        'Hailstorm',
        'Blizzard',
        'Heat Wave',
        'Cold Wave',
        'Industrial Accident',
        'Oil Spill',
        'Pandemic / Disease Outbreak',
        'Other',
    ];

    public function index(Request $request): Response
    {
        $user = $request->user();
        $isAdmin = $user->role === 'admin';

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
        $selectedLocationId = $isAdmin
            ? ($request->filled('location_id') ? $request->input('location_id') : $mainWarehouse?->id)
            : $user->location_id;

        if (!$isAdmin && $selectedLocationId === null) {
            $resources = collect();
        } else {
            $resources = Resource::query()

            ->with('location:id,name,city')

            /*
             * Search
             */
            ->when(
                $request->string('search')->toString(),
                function ($query, $search) {
                    $query->where(function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%")
                          ->orWhere('sku', 'like', "%{$search}%")
                          ->orWhere('qr_code', 'like', "%{$search}%");
                    });
                }
            )

            /*
             * Disaster filter — matches one of the fixed DISASTER_TYPES values.
             */
            ->when(
                $request->string('disaster')->toString(),
                fn ($query, $disaster) => $query->where('disaster', $disaster)
            )

            /*
             * Category filter
             */
            ->when(
                $request->string('category')->toString(),
                fn ($query, $category) => $query->where('category', $category)
            )

            /*
             * Location filter — Main Warehouse used by default.
             */
            ->when(
                $selectedLocationId !== null,
                fn ($query) => $query->where('location_id', $selectedLocationId)
            )

            ->orderBy('name')
            ->get();
        }

        return Inertia::render('resources', [
            'resources'    => $resources,
            'userRole'     => $user->role,

            'locations' => Location::select('id', 'name')
                ->when(!$isAdmin && $user->location_id, fn ($q) => $q->whereKey($user->location_id))
                ->orderBy('name')
                ->get(),

            /*
             * Fixed list of disaster types — no DB query needed.
             */
            'disasterTypes' => self::DISASTER_TYPES,

            /*
             * Send the active filters back to React.
             */
            'filters' => [
                'search'      => $request->input('search'),
                'category'    => $request->input('category'),
                'location_id' => $selectedLocationId,
                'disaster'    => $request->input('disaster'),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can add resources.');

        $mainWarehouse = Location::whereRaw('LOWER(name) = ?', ['main warehouse'])->first();

        if (!$mainWarehouse) {
            return back()->withErrors([
                'location_id' => 'Main Warehouse location does not exist.',
            ]);
        }

        $data = $this->validated($request);

        /*
         * New resources ALWAYS go to Main Warehouse,
         * regardless of what the frontend sends.
         */
        $data['location_id'] = $mainWarehouse->id;

        Resource::create($data);

        return back()->with('success', 'Resource created successfully in Main Warehouse.');
    }

    public function update(Request $request, Resource $resource): RedirectResponse
    {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can edit resources.');

        $data = $this->validated($request, $resource);

        /*
         * Location changes must happen through QR Tracking,
         * not through this form.
         */
        unset($data['location_id']);

        $resource->update($data);

        return back()->with('success', 'Resource updated successfully.');
    }

    public function destroy(Request $request, Resource $resource): RedirectResponse
    {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can delete resources.');

        $resource->delete();

        return back()->with('success', 'Resource deleted successfully.');
    }

    private function validated(Request $request, ?Resource $resource = null): array
    {
        $disasterRule = 'nullable|in:' . implode(',', self::DISASTER_TYPES);

        return $request->validate([
            'name'               => 'required|string|max:255',
            'category'           => 'required|in:food,water,medical,shelter,clothing,hygiene,tools,set,other',
            'sku'                => 'nullable|string|max:100|unique:resources,sku' . ($resource ? ",{$resource->id}" : ''),
            'quantity'           => 'required|integer|min:0',
            'unit'               => 'required|string|max:50',
            'minimum_threshold'  => 'required|integer|min:0',
            'expiry_date'        => 'nullable|date',
            'location_id'        => 'nullable|exists:locations,id',
            'notes'              => 'nullable|string',
            'disaster'           => $disasterRule,
        ]);
    }
}
