<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\Family;
use App\Models\QrScan;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $staff  = $request->user();
        $locId  = $staff->location_id;
        $purokId = $staff->purok_id;

        // Resources are location-scoped (shared at the barangay level)
        $totalResources = Resource::where('location_id', $locId)->count();

        // Families and distributions are purok-scoped (each staff handles their own purok)
        $totalFamilies      = Family::where('purok_id', $purokId)->count();
        $totalDistributions = Distribution::whereHas('family', fn ($q) => $q->where('purok_id', $purokId))->count();

        // QR scans are scoped to the staff member's own scans
        $totalScans = QrScan::where('scanned_by', $staff->id)->count();

        $completedCount  = Distribution::whereHas('family', fn ($q) => $q->where('purok_id', $purokId))->where('status', 'completed')->count();
        $pendingCount    = Distribution::whereHas('family', fn ($q) => $q->where('purok_id', $purokId))->where('status', 'pending')->count();
        $cancelledCount  = Distribution::whereHas('family', fn ($q) => $q->where('purok_id', $purokId))->where('status', 'cancelled')->count();

        $lowStockCount = Resource::where('location_id', $locId)
            ->whereColumn('quantity', '<=', 'minimum_threshold')
            ->count();

        $householdMemberServed = (int) Distribution::whereHas('family', fn ($q) => $q->where('purok_id', $purokId))
            ->where('status', 'completed')
            ->sum('household_member');

        // Resources by category (location-scoped)
        $resourcesByCategory = Resource::where('location_id', $locId)
            ->select('category', DB::raw('count(*) as count'), DB::raw('sum(quantity) as quantity'))
            ->groupBy('category')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($r) => [
                'category' => $r->category ?? 'Uncategorized',
                'count'    => (int) $r->count,
                'quantity' => (int) $r->quantity,
            ]);

        // Distributions by month (purok-scoped, last 6 months)
        $distributionsByMonth = Distribution::whereHas('family', fn ($q) => $q->where('purok_id', $purokId))
            ->select(
                DB::raw("DATE_FORMAT(distribution_date, '%Y-%m') as month"),
                DB::raw('count(*) as count'),
                DB::raw('sum(household_member) as household_member')
            )
            ->where('distribution_date', '>=', now()->subMonths(6))
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($r) => [
                'month'            => $r->month,
                'count'            => (int) $r->count,
                'household_member' => (int) $r->household_member,
            ]);

        // Low stock items (location-scoped)
        $lowStockItems = Resource::where('location_id', $locId)
            ->whereColumn('quantity', '<=', 'minimum_threshold')
            ->select('name', 'quantity', 'unit', 'minimum_threshold')
            ->orderBy('quantity')
            ->get()
            ->map(fn ($r) => [
                'name'              => $r->name,
                'quantity'          => (int) $r->quantity,
                'unit'              => $r->unit,
                'minimum_threshold' => (int) $r->minimum_threshold,
            ]);

        // QR scans by type (staff's own scans)
        $scansByType = QrScan::where('scanned_by', $staff->id)
            ->select('scan_type', DB::raw('count(*) as count'))
            ->groupBy('scan_type')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($r) => [
                'scan_type' => $r->scan_type ?? 'unknown',
                'count'     => (int) $r->count,
            ]);

        // Resources by location (for the staff's location)
        $resourcesByLocation = \App\Models\Location::where('id', $locId)
            ->withCount('resources')
            ->withSum('resources', 'quantity')
            ->get(['id', 'name'])
            ->map(fn ($l) => [
                'location'       => $l->name,
                'resources_count' => (int) ($l->resources_count ?? 0),
                'total_quantity'  => (int) ($l->resources_sum_quantity ?? 0),
            ]);

        return response()->json([
            'reports' => [],
            'summary' => [
                'total_resources'         => $totalResources,
                'total_families'          => $totalFamilies,
                'total_distributions'     => $totalDistributions,
                'total_scans'             => $totalScans,
                'completed_distributions' => $completedCount,
                'pending_distributions'   => $pendingCount,
                'cancelled_distributions' => $cancelledCount,
                'low_stock_count'         => $lowStockCount,
                'household_member_served' => $householdMemberServed,
            ],
            'resources_by_category'   => $resourcesByCategory,
            'distributions_by_month'  => $distributionsByMonth,
            'low_stock'               => $lowStockItems,
            'qr_scans_by_type'        => $scansByType,
            'resources_by_location'   => $resourcesByLocation,
        ]);
    }
}
