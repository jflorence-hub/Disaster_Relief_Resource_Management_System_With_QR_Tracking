<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use Illuminate\Http\JsonResponse;

class LocationController extends Controller
{
    public function registrationOptions(): JsonResponse
    {
        return response()->json([
            'puroks' => \App\Models\Purok::query()->where('status', 'active')->orderBy('name')->get(['id', 'name', 'code']),
            'locations' => Location::query()->where('status', 'active')->orderBy('name')->get(['id', 'name', 'type', 'city', 'status']),
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
