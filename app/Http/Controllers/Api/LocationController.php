<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\Purok;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    /**
     * Public endpoint used by the staff registration form.
     *
     * Returns active locations and puroks. Each purok carries an
     * `is_occupied` flag so the app can grey out already-taken puroks.
     *
     * Accepts an optional `?location_id=` query parameter to return only
     * puroks belonging to that location (used when the user picks a location
     * and the purok dropdown is rebuilt dynamically).
     */
    public function registrationOptions(Request $request): JsonResponse
    {
        // Active locations only
        $locations = Location::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'city', 'status']);

        // Build purok query
        $purokQuery = Purok::query()
            ->where('status', 'active')
            ->with('assignedStaff:id,status')   // only need the status column
            ->orderBy('name');

        // Narrow to a specific location when the caller asks for it
        if ($request->filled('location_id')) {
            $purokQuery->where('location_id', (int) $request->query('location_id'));
        }

        $puroks = $purokQuery
            ->get(['id', 'name', 'code', 'location_id', 'assigned_staff_id'])
            ->map(function (Purok $p) {
                // A purok is occupied when it has an assigned staff whose account is active
                $isOccupied = $p->assigned_staff_id !== null
                    && $p->assignedStaff !== null
                    && $p->assignedStaff->status === 'active';

                return [
                    'id'          => $p->id,
                    'name'        => $p->name,
                    'code'        => $p->code,
                    'location_id' => $p->location_id,
                    'is_occupied' => $isOccupied,
                ];
            });

        return response()->json([
            'puroks'    => $puroks,
            'locations' => $locations,
        ]);
    }

    public function index(): JsonResponse
    {
        $locations = Location::select('id', 'name', 'type', 'address', 'city', 'capacity', 'contact_person', 'contact_phone', 'email', 'status')
            ->where('status', '!=', 'inactive')
            ->withCount([
                'families',
                'resources',
                'distributions as completed_distributions_count' => fn ($q) => $q->where('status', 'completed'),
            ])
            ->withSum('resources', 'quantity')
            ->withSum(
                ['distributions as household_member_served' => fn ($q) => $q->where('status', 'completed')],
                'household_member'
            )
            ->orderBy('name')
            ->get();

        return response()->json(['locations' => $locations]);
    }
}