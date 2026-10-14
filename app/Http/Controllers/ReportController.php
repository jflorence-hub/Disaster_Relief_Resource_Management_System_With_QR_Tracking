<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Models\Family;
use App\Models\Location;
use App\Models\QrScan;
use App\Models\Resource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $admin = $user->role === 'admin';
        $resourceBase = Resource::query()->when(!$admin, fn ($q) => $q->where('location_id', $user->location_id));
        $distributionBase = Distribution::query()->when(!$admin, fn ($q) => $q->where('distributed_by', $user->id));
        $scanBase = QrScan::query()->when(!$admin, fn ($q) => $q->where('scanned_by', $user->id));
        $resourcesByCategory = (clone $resourceBase)
            ->select('category', DB::raw('count(*) as total'), DB::raw('sum(quantity) as quantity'))
            ->groupBy('category')
            ->get();

        $distributionsByMonth = (clone $distributionBase)
            ->select(DB::raw("DATE_FORMAT(distribution_date, '%Y-%m') as month"), DB::raw('sum(quantity) as total_quantity'), DB::raw('sum(household_member) as household_member'))
            ->where('status', 'completed')
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $resourcesByLocation = Location::query()->when(!$admin, fn ($q) => $user->location_id ? $q->whereKey($user->location_id) : $q->whereRaw('1 = 0'))
            ->withCount('resources')
            ->withSum('resources', 'quantity')
            ->get(['id', 'name', 'city']);

        $lowStock = (clone $resourceBase)
            ->whereColumn('quantity', '<=', 'minimum_threshold')
            ->with('location:id,name')
            ->orderBy('quantity')
            ->get();

        $scansByType = (clone $scanBase)
            ->select('scan_type', DB::raw('count(*) as total'))
            ->groupBy('scan_type')
            ->get();

        $summary = [
            'total_resources' => (clone $resourceBase)->count(),
            'total_families' => $admin ? Family::count() : Family::where('purok_id', $user->purok_id)->count(),
            'total_locations' => Location::count(),
            'total_distributions' => (clone $distributionBase)->where('status', 'completed')->count(),
            'total_household_member' => (int) (clone $distributionBase)->where('status', 'completed')->sum('household_member'),
            'low_stock_count' => $lowStock->count(),
            'total_scans' => (clone $scanBase)->count(),
        ];

        return Inertia::render('reports', [
            'summary' => $summary,
            'userRole' => $user->role,
            'resourcesByCategory' => $resourcesByCategory,
            'distributionsByMonth' => $distributionsByMonth,
            'resourcesByLocation' => $resourcesByLocation,
            'lowStock' => $lowStock,
            'scansByType' => $scansByType,
        ]);
    }

    public function exportFamilies(Request $request): StreamedResponse
    {
        $user = $request->user();

        $families = Family::query()
            ->with(['purok:id,name', 'location:id,name'])
            ->when(
                $user->role === 'staff',
                fn ($query) => $user->purok_id
                    ? $query->where('purok_id', $user->purok_id)
                    : $query->whereRaw('1 = 0')
            )
            ->orderBy('family_name')
            ->get();

        return $this->csvResponse(
            'families-report.csv',
            ['Family ID', 'Family Name', 'Head of Family', 'Phone', 'Household Members', 'Address', 'Purok', 'Location', 'Status'],
            $families->map(fn ($family) => [
                $family->family_id,
                $family->family_name,
                $family->head_name,
                $family->phone,
                $family->household_member,
                $family->address,
                $family->purok?->name,
                $family->location?->name,
                $family->status,
            ])
        );
    }

    public function exportInventory(Request $request): StreamedResponse
    {
        $user = $request->user();
        $resources = Resource::when($user->role !== 'admin', fn ($q) => $q->where('location_id', $user->location_id))->with('location:id,name')->orderBy('name')->get();

        return $this->csvResponse('inventory-report.csv', ['Name', 'SKU', 'QR Code', 'Category', 'Quantity', 'Unit', 'Min Threshold', 'Status', 'Location', 'Expiry Date'], $resources->map(fn ($r) => [
            $r->name, $r->sku, $r->qr_code, $r->category, $r->quantity, $r->unit, $r->minimum_threshold, $r->status, $r->location?->name, $r->expiry_date,
        ]));
    }

    public function exportDistributions(Request $request): StreamedResponse
    {
        $user = $request->user();
        $distributions = Distribution::when($user->role !== 'admin', fn ($q) => $q->where('distributed_by', $user->id))->with(['resource:id,name,unit', 'location:id,name', 'distributor:id,name'])
            ->orderByDesc('distribution_date')
            ->get();

        return $this->csvResponse('distribution-report.csv', ['Date', 'Resource', 'Quantity', 'Recipient', 'Household Member', 'Location', 'Status', 'Distributed By'], $distributions->map(fn ($d) => [
            $d->distribution_date, $d->resource?->name, $d->quantity, $d->recipient_name, $d->household_member, $d->location?->name, $d->status, $d->distributor?->name,
        ]));
    }

    public function exportQrScans(Request $request): StreamedResponse
    {
        $user = $request->user();
        $scans = QrScan::when($user->role !== 'admin', fn ($q) => $q->where('scanned_by', $user->id))->with(['resource:id,name', 'location:id,name', 'scanner:id,name'])
            ->orderByDesc('scanned_at')
            ->get();

        return $this->csvResponse('qr-tracking-report.csv', ['Date', 'Resource', 'Scan Type', 'Quantity Change', 'Location', 'Scanned By'], $scans->map(fn ($s) => [
            $s->scanned_at, $s->resource?->name, $s->scan_type, $s->quantity_change, $s->location?->name, $s->scanner?->name,
        ]));
    }

    private function csvResponse(string $filename, array $headers, $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }
}
