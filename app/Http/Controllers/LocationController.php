<?php

namespace App\Http\Controllers;

use App\Models\Location;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LocationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isAdmin = $user->role === 'admin';
        $locations = Location::query()
            ->when(!$isAdmin && $user->location_id, fn ($q) => $q->whereKey($user->location_id))
            ->withCount('families')
            ->withCount('resources')
            ->withSum('resources', 'quantity')
            ->withCount([
                'distributions as completed_distributions_count' =>
                    fn($q) => $q->where('status', 'completed')
            ])
            ->withSum([
                'distributions as household_member_served' =>
                    fn($q) => $q->where('status', 'completed')
            ], 'household_member')
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
                                'city',
                                'like',
                                "%{$search}%"
                            );
                    });
                }
            )
            ->when(
                $request->string('type')->toString(),
                fn($query, $type) =>
                    $query->where('type', $type)
            )
            ->orderBy('name')
            ->get();

        return Inertia::render('locations', [
            'locations' => $locations,
            'userRole' => $user->role,
            'filters' => $request->only([
                'search',
                'type'
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can create locations.');

        Location::create($this->validated($request));

        return back()->with(
            'success',
            'Location created successfully. 7 puroks (Purok 1–7) were created automatically.'
        );
    }

    public function update(
        Request $request,
        Location $location
    ): RedirectResponse {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can edit locations.');
        $location->update(
            $this->validated($request)
        );

        return back()->with(
            'success',
            'Location updated successfully.'
        );
    }

    public function destroy(Request $request, Location $location): RedirectResponse {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can delete locations.');
        $location->delete();

        return back()->with(
            'success',
            'Location deleted successfully.'
        );
    }

    private function validated(
        Request $request
    ): array {
        return $request->validate([
            'name'           => 'required|string|max:255',
            'type'           => 'required|in:warehouse,distribution_center,shelter,field_office',
            'address'        => 'required|string|max:255',
            'city'           => 'required|string|max:255',
            'latitude'       => 'nullable|numeric|between:-90,90',
            'longitude'      => 'nullable|numeric|between:-180,180',
            'capacity'       => 'required|integer|min:0',
            'contact_person' => 'nullable|string|max:255',
            'contact_phone'  => 'nullable|string|max:50',
            'email'          => 'nullable|email|max:255',
            'status'         => 'required|in:active,inactive,maintenance',
        ]);
    }
}