<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Models\Location;
use App\Models\QrScan;
use App\Models\Resource;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $stats = [
            'total_resources' => (int) Resource::sum('quantity'),
            'total_locations' => Location::count(),
            'low_stock_count' => Resource::whereColumn('quantity', '<=', 'minimum_threshold')->count(),
            'pending_distributions' => Distribution::whereIn('status', ['pending', 'in_transit'])->count(),
            'completed_distributions' => Distribution::where('status', 'completed')->count(),
            'beneficiaries_served' => (int) Distribution::where('status', 'completed')->sum('beneficiary_count'),
            'total_scans' => QrScan::count(),
            'active_team_members' => \App\Models\User::where('status', 'active')->count(),
        ];

        $recentDistributions = Distribution::with(['resource:id,name,unit', 'location:id,name'])
            ->orderByDesc('distribution_date')
            ->limit(5)
            ->get();

        $recentScans = QrScan::with(['resource:id,name', 'scanner:id,name'])
            ->orderByDesc('scanned_at')
            ->limit(5)
            ->get();

        $lowStockResources = Resource::whereColumn('quantity', '<=', 'minimum_threshold')
            ->with('location:id,name')
            ->orderBy('quantity')
            ->limit(5)
            ->get();

        return Inertia::render('dashboard', [
            'stats' => $stats,
            'recentDistributions' => $recentDistributions,
            'recentScans' => $recentScans,
            'lowStockResources' => $lowStockResources,
        ]);
    }
}
