<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QrScan;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QrTrackingController extends Controller
{
    /**
     * Look up a resource by its QR code value straight after a camera scan.
     */
    public function lookup(Request $request): JsonResponse
    {
        $request->validate(['qr_code' => 'required|string']);

        $resource = Resource::with('location:id,name')
            ->where('qr_code', trim($request->string('qr_code')))
            ->first();

        if (! $resource) {
            return response()->json([
                'found' => false,
                'message' => 'No resource matches this QR code.',
            ], 404);
        }

        $lastScan = QrScan::where('resource_id', $resource->id)
            ->with(['location:id,name', 'scanner:id,name'])
            ->orderByDesc('scanned_at')
            ->first();

        return response()->json([
            'found' => true,
            'resource' => $resource,
            'last_scan' => $lastScan,
        ]);
    }

    /**
     * Record a scan from the mobile app. This writes to the same database
     * the admin web dashboard reads from, so the change is reflected there
     * as soon as the admin page is loaded or polled.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'qr_code' => 'required|string|exists:resources,qr_code',
            'location_id' => 'nullable|exists:locations,id',
            'scan_type' => 'required|in:check_in,check_out,audit,transfer',
            'recipient_name' => 'nullable|string|max:255',
            'quantity_change' => 'required|integer',
            'notes' => 'nullable|string',
        ]);

        $scan = DB::transaction(function () use ($data, $request) {
            $resource = Resource::where('qr_code', $data['qr_code'])->firstOrFail();

            $scan = QrScan::create([
                'resource_id' => $resource->id,
                'location_id' => $data['location_id'] ?? $resource->location_id,
                'scanned_by' => $request->user()->id,
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

            return $scan->load(['resource.location:id,name', 'location:id,name', 'scanner:id,name']);
        });

        return response()->json([
            'message' => 'Scan recorded successfully.',
            'scan' => $scan,
            'resource' => $scan->resource,
        ], 201);
    }

    /**
     * Recent scans, for the mobile app's history tab.
     */
    public function index(): JsonResponse
    {
        $scans = QrScan::with(['resource:id,name,qr_code,unit', 'location:id,name', 'scanner:id,name'])
            ->orderByDesc('scanned_at')
            ->limit(50)
            ->get();

        return response()->json(['scans' => $scans]);
    }
}
