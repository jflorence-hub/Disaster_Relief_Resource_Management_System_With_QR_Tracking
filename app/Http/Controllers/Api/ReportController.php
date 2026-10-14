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
        $staff = $request->user();
        $locId = $staff->location_id;

        $totalResources     = Resource::where('location_id', $locId)->count();
        $totalFamilies      = Family::where('location_id', $locId)->count();
        $totalDistributions = Distribution::where('location_id', $locId)->count();
        $totalScans         = QrScan::where('scanned_by', $staff->id)->count();

        $completedCount  = Distribution::where('location_id', $locId)->where('status', 'completed')->count();
        $pendingCount    = Distribution::where('location_id', $locId)->where('status', 'pending')->count();
        $cancelledCount  = Distribution::where('location_id', $locId)->where('status', 'cancelled')->count();

        $lowStockCount = Resource::where('location_id', $locId)
            ->whereColumn('quantity', '<=', 'minimum_threshold')
            ->count();

        $householdMemberServed = (int) Distribution::where('location_id', $locId)
            ->where('status', 'completed')
            ->sum('household_member');

        // Resources by category
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

        // Distributions by month (last 6 months)
        $distributionsByMonth = Distribution::where('location_id', $locId)
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

        // Low stock items detail
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
        ]);
    }
}
