<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\QrScan;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class QrTrackingController extends Controller
{
    public function index(Request $request): Response
    {
        $scans = QrScan::query()
            ->with(['resource:id,name,qr_code,unit', 'location:id,name', 'scanner:id,name'])
            ->orderByDesc('scanned_at')
            ->limit(200)
            ->get();

        return Inertia::render('qr-tracking', [
            'scans' => $scans,
            'resources' => Resource::select('id', 'name', 'qr_code', 'quantity', 'unit', 'location_id')
                ->with('location:id,name')
                ->orderBy('name')
                ->get(),
            'locations' => Location::select('id', 'name')->orderBy('name')->get(),
        ]);
    }

    /**
     * Look up a resource by its scanned QR code value (used by the camera scanner).
     */
    public function lookup(Request $request): JsonResponse
    {
        $request->validate(['qr_code' => 'required|string']);

        $resource = Resource::with('location:id,name')
            ->where('qr_code', $request->string('qr_code')->trim())
            ->first();

        $lastScan = $resource
            ? QrScan::where('resource_id', $resource->id)->with('location:id,name')->orderByDesc('scanned_at')->first()
            : null;

        return response()->json([
            'resource' => $resource,
            'last_scan' => $lastScan,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'qr_code' => 'required|string|exists:resources,qr_code',
            'location_id' => 'nullable|exists:locations,id',
            'scan_type' => 'required|in:check_in,check_out,audit,transfer',
            'recipient_name' => 'nullable|string|max:255',
            'quantity_change' => 'required|integer',
            'notes' => 'nullable|string',
        ]);

        DB::transaction(function () use ($data, $request) {
            $resource = Resource::where('qr_code', $data['qr_code'])->firstOrFail();

            QrScan::create([
                'resource_id' => $resource->id,
                'location_id' => $data['location_id'] ?? $resource->location_id,
                'scanned_by' => $request->user()?->id,
                'scan_type' => $data['scan_type'],
                'recipient_name' => $data['recipient_name'] ?? null,
                'quantity_change' => $data['quantity_change'],
                'notes' => $data['notes'] ?? null,
                'scanned_at' => now(),
            ]);

            if ($data['quantity_change'] !== 0) {
                $resource->quantity = max(0, $resource->quantity + $data['quantity_change']);
                $resource->save();
            }

            if (! empty($data['location_id']) && $data['location_id'] != $resource->location_id) {
                $resource->location_id = $data['location_id'];
                $resource->save();
            }
        });

        return back()->with('success', 'Scan recorded successfully.');
    }

    public function destroy(QrScan $qrScan): RedirectResponse
    {
        $qrScan->delete();

        return back()->with('success', 'Scan record deleted.');
    }
}
