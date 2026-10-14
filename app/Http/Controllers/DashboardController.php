<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Models\Family;
use App\Models\Location;
use App\Models\QrScan;
use App\Models\Resource;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $admin = $user->role === 'admin';
        $resourceQuery = Resource::query()->when(!$admin, fn ($q) => $q->where('location_id', $user->location_id));
        $distributionQuery = Distribution::query()->when(!$admin, fn ($q) => $q->where('distributed_by', $user->id));
        $scanQuery = QrScan::query()->when(!$admin, fn ($q) => $q->where('scanned_by', $user->id));

        $stats = [
            // Count resource records at this location, not the stock quantity.
            'total_resources' => (clone $resourceQuery)->count(),
            'total_families' => $admin ? Family::count() : Family::where('purok_id', $user->purok_id)->count(),
            'total_resource_quantity' => (int) (clone $resourceQuery)->sum('quantity'),
            'total_locations' => $admin ? Location::count() : (int) ($user->location_id ? 1 : 0),
            'low_stock_count' => (clone $resourceQuery)->whereColumn('quantity', '<=', 'minimum_threshold')->count(),
            'pending_distributions' => (clone $distributionQuery)->whereIn('status', ['pending', 'in_transit'])->count(),
            'completed_distributions' => (clone $distributionQuery)->where('status', 'completed')->count(),
            'household_member_served' => (int) (clone $distributionQuery)->where('status', 'completed')->sum('household_member'),
            'total_scans' => (clone $scanQuery)->count(),
            'active_team_members' => $admin ? User::where('status', 'active')->count() : 1,
        ];

        $recentDistributions = (clone $distributionQuery)->with(['resource:id,name,unit', 'location:id,name', 'distributor:id,name'])
            ->orderByDesc('distribution_date')->limit(5)->get();
        $recentScans = (clone $scanQuery)->with(['resource:id,name', 'scanner:id,name'])
            ->orderByDesc('scanned_at')->limit(5)->get();
        $lowStockResources = (clone $resourceQuery)->whereColumn('quantity', '<=', 'minimum_threshold')
            ->with('location:id,name')->orderBy('quantity')->limit(5)->get();

        return Inertia::render('dashboard', [
            'stats' => $stats,
            'recentDistributions' => $recentDistributions,
            'recentScans' => $recentScans,
            'lowStockResources' => $lowStockResources,
            'userRole' => $user->role,
            'staffContext' => $admin ? null : [
                'location' => $user->location?->name,
                'hasPurok' => $user->purok_id !== null,
                'purok' => $user->purok?->name,
            ],
        ]);
    }
}
