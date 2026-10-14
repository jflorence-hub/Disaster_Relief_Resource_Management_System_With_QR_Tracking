<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\Family;
use App\Models\QrScan;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $staff = $request->user();

        $totalResources     = Resource::where('location_id', $staff->location_id)->count();
        $totalFamilies      = Family::where('location_id', $staff->location_id)->count();
        $totalDistributions = Distribution::where('location_id', $staff->location_id)->count();
        $totalScans         = QrScan::where('scanned_by', $staff->id)->count();

        $lowStockCount = Resource::where('location_id', $staff->location_id)
            ->whereColumn('quantity', '<=', 'minimum_threshold')
            ->count();

        $householdMemberServed = (int) Distribution::where('location_id', $staff->location_id)
            ->where('status', 'completed')
            ->sum('household_member');

        return response()->json([
            'reports' => [],
            'summary' => [
                'total_resources'          => $totalResources,
                'total_families'           => $totalFamilies,
                'total_distributions'      => $totalDistributions,
                'total_scans'              => $totalScans,
                'low_stock_count'          => $lowStockCount,
                'household_member_served'  => $householdMemberServed,
            ],
        ]);
    }
}
