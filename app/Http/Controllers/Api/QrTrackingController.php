<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\QrScan;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
     *
     * When scan_type = 'completed' and a family_id is supplied the method:
     *  1. Checks whether the family is excluded from the current distribution.
     *  2. Checks for a duplicate scan / already-completed distribution.
     *  3. Inside a DB transaction: marks the distribution completed, sets
     *     claimed_by, deducts stock, and saves the QrScan record.
     *
     * HTTP responses for error states:
     *  403 â€” family is excluded from this distribution
     *  409 â€” family has already been scanned / distribution already completed
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

        // â”€â”€ Distribution-completion flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if ($validated['scan_type'] === 'completed' && ! empty($validated['family_id'])) {
            return $this->handleCompletionScan($validated, $request);
        }

        // â”€â”€ Non-completion scans (pending / cancelled) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        $scan = $this->saveScan($validated, $request);

        return response()->json([
            'message' => 'Scan recorded successfully.',
            'scan'    => $scan,
        ], 201);
    }

    // â”€â”€â”€ Private helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Handle scan_type = 'completed' for a known family.
     * Atomically marks the distribution completed and deducts stock.
     */
    private function handleCompletionScan(array $validated, Request $request): JsonResponse
    {
        $familyId = $validated['family_id'];

        // QR-code-first lookup: if the request carries a QR code that matches a
        // distribution record, use that record directly. Fall back to the latest
        // non-cancelled distribution for the family when no QR code match exists.
        $qrCode = ! empty($validated['qr_code']) ? trim($validated['qr_code']) : null;
        $distribution = null;

        if ($qrCode !== null) {
            $distribution = Distribution::where('qr_code', $qrCode)
                ->whereNotIn('status', ['cancelled'])
                ->first();
        }

        if ($distribution === null) {
            $distribution = Distribution::where('family_id', $familyId)
                ->whereNotIn('status', ['cancelled'])
                ->orderByDesc('distribution_date')
                ->orderByDesc('id')
                ->first();
        }

        // â”€â”€ Exclusion check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if ($distribution && $distribution->excluded) {
            return response()->json([
                'message'          => 'This family is excluded from this distribution schedule.',
                'exclusion_reason' => $distribution->exclusion_reason ?? 'No reason provided.',
                'excluded'         => true,
            ], 403);
        }

        // â”€â”€ Duplicate / already-completed check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if ($distribution && $distribution->status === 'completed') {
            return response()->json([
                'message'           => 'This family has already received their relief goods for this distribution schedule.',
                'family_name'       => $distribution->family?->family_name ?? '',
                'claimed_at'        => $distribution->updated_at?->format('Y-m-d H:i:s') ?? '',
                'claimed_by'        => $distribution->claimed_by,
                'already_completed' => true,
            ], 409);
        }

        // Also check the QrScan table in case the distribution record wasn't
        // updated in a previous attempt (belt-and-suspenders).
        $existingScan = QrScan::where('family_id', $familyId)
            ->where('scan_type', 'completed')
            ->orderByDesc('scanned_at')
            ->first();

        if ($existingScan) {
            $familyName = $distribution?->family?->family_name
                ?? \App\Models\Family::find($familyId)?->family_name
                ?? '';

            return response()->json([
                'message'           => 'This family has already received their relief goods for this distribution schedule.',
                'family_name'       => $familyName,
                'claimed_at'        => $existingScan->scanned_at?->format('Y-m-d H:i:s') ?? '',
                'claimed_by'        => $existingScan->receiver,
                'already_completed' => true,
            ], 409);
        }

        // Resolve resource_id
        $resourceId = $validated['resource_id']
            ?? $distribution?->resource_id
            ?? null;

        // â”€â”€ Atomic commit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        $scan = DB::transaction(function () use ($validated, $request, $distribution, $resourceId, $familyId) {
            // Mark distribution completed
            if ($distribution && $distribution->status === 'pending') {
                $distribution->status     = 'completed';
                $distribution->claimed_by = $validated['receiver'] ?? null;
                $distribution->save();
                $distribution->applyStock();
            }

            // Save the scan record
            return $this->createScanRecord($validated, $request, $resourceId, $familyId);
        });

        $scan->load([
            'family:id,family_id,family_name,head_name,purok_id',
            'family.purok:id,name',
            'resource:id,name,unit',
            'location:id,name',
            'scanner:id,name',
        ]);

        return response()->json([
            'message' => 'Scan recorded. Distribution marked as completed.',
            'scan'    => $scan,
        ], 201);
    }

    /**
     * Save a non-completion (pending/cancelled) scan record.
     */
    private function saveScan(array $validated, Request $request): QrScan
    {
        $resourceId = null;
        if (! empty($validated['family_id'])) {
            $dist = Distribution::where('family_id', $validated['family_id'])
                ->whereNotIn('status', ['cancelled'])
                ->orderByDesc('distribution_date')
                ->first(['resource_id']);
            $resourceId = $dist?->resource_id;
        }
        if (! empty($validated['resource_id'])) {
            $resourceId = $validated['resource_id'];
        }

        $scan = $this->createScanRecord($validated, $request, $resourceId, $validated['family_id'] ?? null);

        $scan->load([
            'family:id,family_id,family_name,head_name,purok_id',
            'family.purok:id,name',
            'resource:id,name,unit',
            'location:id,name',
            'scanner:id,name',
        ]);

        return $scan;
    }

    /**
     * Insert a QrScan row and return the model.
     */
    private function createScanRecord(array $validated, Request $request, ?int $resourceId, ?int $familyId): QrScan
    {
        return QrScan::create([
            'family_id'       => $familyId,
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
    }

    /**
     * Recent scans, for the mobile app's history tab.
     * Scoped to the authenticated staff member's own scans.
     */
    public function index(Request $request): JsonResponse
    {
        $scans = QrScan::with([
            'family:id,family_id,family_name,head_name,purok_id',
            'family.purok:id,name',
            'resource:id,name,qr_code,unit',
            'location:id,name',
            'scanner:id,name',
        ])
            ->where('scanned_by', $request->user()->id)
            ->orderByDesc('scanned_at')
            ->limit(50)
            ->get();

        return response()->json(['scans' => $scans]);
    }
}

