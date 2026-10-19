<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\Resource;
use App\Models\ResourceSet;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ResourceController extends Controller
{
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
             * Category filter
             */
            ->when(
                $request->string('category')->toString(),
                fn ($query, $category) => $query->where('category', $category)
            )

            /*
             * Location filter - Main Warehouse used by default.
             */
            ->when(
                $selectedLocationId !== null,
                fn ($query) => $query->where('location_id', $selectedLocationId)
            )

            ->orderBy('name')
            ->get();

        // Attach families_coverable to each resource:
        // how many families the current stock can cover, based on 1 unit per family.
        // Used as a soft warning indicator — not a save gate.
        if ($selectedLocationId) {
            $familyCount = \App\Models\Family::where('status', 'active')
                ->where('location_id', (int) $selectedLocationId)
                ->count();
        } else {
            $familyCount = 0;
        }

        $resources = $resources->map(function ($r) use ($familyCount) {
            $r->families_coverable = $familyCount > 0 ? (int) floor($r->quantity / 1) : null;
            $r->families_at_location = $familyCount;

            // Expiry flags
            $today = now()->startOfDay();
            if ($r->expiry_date) {
                $expiry = \Illuminate\Support\Carbon::parse($r->expiry_date)->startOfDay();
                $r->is_expired     = $expiry->lt($today);
                $r->expiring_soon  = ! $r->is_expired && $expiry->diffInDays($today) <= 30;
                $r->days_until_expiry = $r->is_expired ? 0 : (int) $today->diffInDays($expiry);
            } else {
                $r->is_expired    = false;
                $r->expiring_soon = false;
                $r->days_until_expiry = null;
            }

            return $r;
        });
        }

        // Top-level expiry alerts: all resources (across all locations) expiring within 30 days
        $expiryAlerts = Resource::query()
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '>=', now()->toDateString())
            ->whereDate('expiry_date', '<=', now()->addDays(30)->toDateString())
            ->orderBy('expiry_date')
            ->get(['id', 'name', 'expiry_date'])
            ->map(function ($r) {
                $days = (int) now()->startOfDay()->diffInDays(
                    \Illuminate\Support\Carbon::parse($r->expiry_date)->startOfDay()
                );
                return ['id' => $r->id, 'name' => $r->name, 'days' => $days];
            });

        $resourceSets = ResourceSet::query()
            ->with([
                'items.resource:id,name,unit',
                'location:id,name',
            ])
            ->orderBy('name')
            ->get();

        return Inertia::render('resources', [
            'resources'    => $resources,
            'userRole'     => $user->role,
            'resourceSets' => $resourceSets,
            'expiryAlerts' => $expiryAlerts ?? collect(),

            'locations' => Location::select('id', 'name')
                ->when(!$isAdmin && $user->location_id, fn ($q) => $q->whereKey($user->location_id))
                ->orderBy('name')
                ->get(),

            /*
             * Send the active filters back to React.
             */
            'filters' => [
                'search'      => $request->input('search'),
                'category'    => $request->input('category'),
                'location_id' => $selectedLocationId,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can add resources.');

        $data = $this->validated($request);

        // Use the submitted location_id if provided; fall back to Main Warehouse only when absent.
        if (empty($data['location_id'])) {
            $mainWarehouse = Location::whereRaw('LOWER(name) = ?', ['main warehouse'])->first();

            if (!$mainWarehouse) {
                return back()->withErrors([
                    'location_id' => 'No location selected and Main Warehouse does not exist.',
                ]);
            }

            $data['location_id'] = $mainWarehouse->id;
        }

        $resource = Resource::create($data);

        $locationName = $resource->location?->name ?? 'selected location';

        return back()->with('success', "Resource created successfully in {$locationName}.");
    }

    public function update(Request $request, Resource $resource): RedirectResponse
    {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can edit resources.');

        $data = $this->validated($request, $resource);

        // location_id can now be changed via the edit form.
        // Use QR Tracking to record physical stock movements;
        // this form is for manual corrections.
        if (empty($data['location_id'])) {
            unset($data['location_id']);
        }

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
        ]);
    }
}
