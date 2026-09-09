<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
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
    public function index(): Response
    {
        $resourcesByCategory = Resource::query()
            ->select('category', DB::raw('count(*) as total'), DB::raw('sum(quantity) as quantity'))
            ->groupBy('category')
            ->get();

        $distributionsByMonth = Distribution::query()
            ->select(DB::raw("DATE_FORMAT(distribution_date, '%Y-%m') as month"), DB::raw('sum(quantity) as total_quantity'), DB::raw('sum(beneficiary_count) as beneficiaries'))
            ->where('status', 'completed')
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $resourcesByLocation = Location::query()
            ->withCount('resources')
            ->withSum('resources', 'quantity')
            ->get(['id', 'name', 'city']);

        $lowStock = Resource::query()
            ->whereColumn('quantity', '<=', 'minimum_threshold')
            ->with('location:id,name')
            ->orderBy('quantity')
            ->get();

        $scansByType = QrScan::query()
            ->select('scan_type', DB::raw('count(*) as total'))
            ->groupBy('scan_type')
            ->get();

        $summary = [
            'total_resources' => (int) Resource::sum('quantity'),
            'total_locations' => Location::count(),
            'total_distributions' => Distribution::where('status', 'completed')->count(),
            'total_beneficiaries' => (int) Distribution::where('status', 'completed')->sum('beneficiary_count'),
            'low_stock_count' => $lowStock->count(),
            'total_scans' => QrScan::count(),
        ];

        return Inertia::render('reports', [
            'summary' => $summary,
            'resourcesByCategory' => $resourcesByCategory,
            'distributionsByMonth' => $distributionsByMonth,
            'resourcesByLocation' => $resourcesByLocation,
            'lowStock' => $lowStock,
            'scansByType' => $scansByType,
        ]);
    }

    public function exportInventory(): StreamedResponse
    {
        $resources = Resource::with('location:id,name')->orderBy('name')->get();

        return $this->csvResponse('inventory-report.csv', ['Name', 'SKU', 'QR Code', 'Category', 'Quantity', 'Unit', 'Min Threshold', 'Status', 'Location', 'Expiry Date'], $resources->map(fn ($r) => [
            $r->name, $r->sku, $r->qr_code, $r->category, $r->quantity, $r->unit, $r->minimum_threshold, $r->status, $r->location?->name, $r->expiry_date,
        ]));
    }

    public function exportDistributions(Request $request): StreamedResponse
    {
        $distributions = Distribution::with(['resource:id,name,unit', 'location:id,name', 'distributor:id,name'])
            ->orderByDesc('distribution_date')
            ->get();

        return $this->csvResponse('distribution-report.csv', ['Date', 'Resource', 'Quantity', 'Recipient', 'Beneficiaries', 'Location', 'Status', 'Distributed By'], $distributions->map(fn ($d) => [
            $d->distribution_date, $d->resource?->name, $d->quantity, $d->recipient_name, $d->beneficiary_count, $d->location?->name, $d->status, $d->distributor?->name,
        ]));
    }

    public function exportQrScans(): StreamedResponse
    {
        $scans = QrScan::with(['resource:id,name', 'location:id,name', 'scanner:id,name'])
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
