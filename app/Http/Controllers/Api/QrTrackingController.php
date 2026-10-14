<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QrScan;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QrTrackingController extends Controller
{
    /**
     * Look up a resource by QR code (kept for route compatibility).
     */
    public function lookup(Request $request): JsonResponse
    {
        $request->validate(['qr_code' => 'required|string']);

        $resource = Resource::with('location:id,name')
            ->where('qr_code', trim($request->string('qr_code')))
            ->first();

        if (! $resource) {
            return response()->json([
                'found'   => false,
                'message' => 'No resource matches this QR code.',
            ], 404);
        }

        $lastScan = QrScan::where('resource_id', $resource->id)
            ->with(['location:id,name', 'scanner:id,name'])
            ->orderByDesc('scanned_at')
            ->first();

        return response()->json([
            'found'     => true,
            'resource'  => $resource,
            'last_scan' => $lastScan,
        ]);
    }

    /**
     * Record a scan from the mobile app.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'qr_code'         => 'nullable|string',
            'family_id'       => 'nullable|exists:families,id',
            'location_id'     => 'nullable|exists:locations,id',
            'scan_type'       => 'required|in:completed,pending,cancelled',
            'receiver'        => 'nullable|string|max:255',
            'resource_id'     => 'nullable|exists:resources,id',
            'quantity_change' => 'required|integer|min:1',
            'scan_date'       => 'nullable|date',
            'scan_time'       => 'nullable|string|max:10',
        ]);

        // Resolve resource_id from the family's latest distribution
        $resourceId = null;
        if (! empty($validated['family_id'])) {
            $dist = \App\Models\Distribution::where('family_id', $validated['family_id'])
                ->whereNotIn('status', ['cancelled'])
                ->orderByDesc('distribution_date')
                ->first(['resource_id']);
            $resourceId = $dist?->resource_id;
        }

        // Allow explicit resource_id from the request to override the resolved one
        if (! empty($validated['resource_id'])) {
            $resourceId = $validated['resource_id'];
        }

        $scan = QrScan::create([
            'family_id'       => $validated['family_id'] ?? null,
            'resource_id'     => $resourceId,
            'location_id'     => $validated['location_id'] ?? null,
            'scanned_by'      => $request->user()->id,
            'scan_type'       => $validated['scan_type'],
            'receiver'        => $validated['receiver'] ?? null,
            'quantity_change' => (int) $validated['quantity_change'],
            'scanned_at'      => now(),
            'scan_date'       => $validated['scan_date'] ?? now()->toDateString(),
            'scan_time'       => $validated['scan_time'] ?? now()->format('H:i'),
        ]);

        $scan->load([
            'family:id,family_id,family_name,head_name,purok_id',
            'family.purok:id,name',
            'resource:id,name,unit',
            'location:id,name',
            'scanner:id,name',
        ]);

        return response()->json([
            'message' => 'Scan recorded successfully.',
            'scan'    => $scan,
        ], 201);
    }

    /**
     * Recent scans, for the mobile app's history tab.
     */
    public function index(): JsonResponse
    {
        $scans = QrScan::with([
            'family:id,family_id,family_name,head_name,purok_id',
            'family.purok:id,name',
            'resource:id,name,qr_code,unit',
            'location:id,name',
            'scanner:id,name',
        ])
            ->orderByDesc('scanned_at')
            ->limit(50)
            ->get();

        return response()->json(['scans' => $scans]);
    }
}
