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
     *  403 — family is excluded from this distribution
     *  409 — family has already been scanned / distribution already completed
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
            'resource_label'  => 'nullable|string|max:255',
            'quantity_change' => 'required|integer|min:1',
            'scan_date'       => 'nullable|date',
            'scan_time'       => 'nullable|string|max:10',
        ]);

        // â”€â”€ Distribution-completion flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        $distribution = $this->resolveFamilyDistribution($validated);
        if (! empty($validated['family_id']) && ! $distribution) {
            return response()->json([
                'message' => 'No scheduled distribution was found for this family.',
            ], 404);
        }

        if ($distribution) {
            if ((int) $distribution->family_id !== (int) ($validated['family_id'] ?? 0)) {
                return response()->json([
                    'message' => 'The scanned QR code does not belong to this family.',
                ], 422);
            }

            if ($windowError = $distribution->claimWindowError()) {
                return response()->json([
                    'message' => $windowError,
                    'distribution_not_open' => true,
                ], 403);
            }

            $validated['receiver'] = $distribution->claimed_by
                ?? $distribution->recipient_name
                ?? $distribution->family?->head_name;
            $validated['resource_label'] = $distribution->resourceSet?->name
                ?? $distribution->resource?->name;
        }

        if ($validated['scan_type'] === 'completed' && ! empty($validated['family_id'])) {
            return $this->handleCompletionScan($validated, $request, $distribution);
        }

        // â”€â”€ Non-completion scans (pending / cancelled) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        $scan = $this->saveScan($validated, $request, $distribution);

        return response()->json([
            'message' => 'Scan recorded successfully.',
            'scan'    => $scan,
        ], 201);
    }

    // â”€â”€â”€ Private helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Handle scan_type = 'completed' for a known family.
     * Atomically marks the distribution completed and deducts stock.
     *
     * Only permits scans during the distribution's scheduled claim window.
     */
    private function handleCompletionScan(
        array $validated,
        Request $request,
        Distribution $distribution
    ): JsonResponse
    {
        $familyId = $validated['family_id'];

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
                'head_name'         => $distribution->family?->head_name ?? '',
                'claimed_at'        => $distribution->updated_at?->format('Y-m-d H:i:s') ?? '',
                'claimed_by'        => $distribution->claimed_by,
                'already_completed' => true,
            ], 409);
        }

        // Also check the QrScan table in case the distribution record wasn't
        // updated in a previous attempt (belt-and-suspenders).
        $existingScan = $distribution
            ? QrScan::where('distribution_id', $distribution->id)
                ->where('scan_type', 'completed')
                ->orderByDesc('scanned_at')
                ->first()
            : null;

        if ($existingScan) {
            $headName = $distribution?->family?->head_name
                ?? \App\Models\Family::find($familyId)?->head_name
                ?? '';

            return response()->json([
                'message'           => 'This family has already received their relief goods for this distribution schedule.',
                'head_name'         => $headName,
                'claimed_at'        => $existingScan->scanned_at?->format('Y-m-d H:i:s') ?? '',
                'claimed_by'        => $existingScan->receiver,
                'already_completed' => true,
            ], 409);
        }

        // Resolve resource_id
        $resourceId = $distribution->resource_id;

        // â”€â”€ Atomic commit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        $scan = DB::transaction(function () use ($validated, $request, $distribution, $resourceId, $familyId) {
            $lockedDistribution = Distribution::query()
                ->lockForUpdate()
                ->findOrFail($distribution->id);
            $windowError = $lockedDistribution->claimWindowError();
            abort_if($windowError !== null, 403, $windowError);
            abort_if($lockedDistribution->excluded, 403, 'This family is excluded from this distribution schedule.');
            abort_if($lockedDistribution->status === 'completed', 409, 'This family has already received their relief goods for this distribution schedule.');

            if ($lockedDistribution->status === 'pending') {
                $lockedDistribution->status     = 'completed';
                $lockedDistribution->claimed_by = $validated['receiver'] ?? null;
                $lockedDistribution->save();
                $lockedDistribution->applyStock();
            }

            // Save the scan record
            return $this->createScanRecord(
                $validated,
                $request,
                $resourceId,
                $familyId,
                $lockedDistribution->id
            );
        });

        $scan->load([
            'family:id,family_id,head_name,purok_id',
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
    private function saveScan(
        array $validated,
        Request $request,
        ?Distribution $distribution
    ): QrScan
    {
        $resourceId = $distribution
            ? $distribution->resource_id
            : ($validated['resource_id'] ?? null);
        if (! $distribution) {
            $validated['resource_label'] = $validated['resource_label'] ?? null;
        }

        $scan = $this->createScanRecord(
            $validated,
            $request,
            $resourceId,
            $validated['family_id'] ?? null,
            $distribution?->id
        );

        $scan->load([
            'family:id,family_id,head_name,purok_id',
            'family.purok:id,name',
            'resource:id,name,unit',
            'location:id,name',
            'scanner:id,name',
        ]);

        return $scan;
    }

    private function resolveFamilyDistribution(array $validated): ?Distribution
    {
        $qrCode = ! empty($validated['qr_code']) ? trim($validated['qr_code']) : null;
        $distribution = $qrCode
            ? Distribution::with(['family', 'resource', 'resourceSet'])
                ->where('qr_code', $qrCode)
                ->first()
            : null;

        if (! $distribution && ! empty($validated['family_id'])) {
            $distribution = Distribution::with(['family', 'resource', 'resourceSet'])
                ->where('family_id', $validated['family_id'])
                ->whereNotIn('status', ['cancelled'])
                ->orderByDesc('distribution_date')
                ->orderByDesc('id')
                ->first();
        }

        return $distribution;
    }

    /**
     * Insert a QrScan row and return the model.
     */
    private function createScanRecord(
        array $validated,
        Request $request,
        ?int $resourceId,
        ?int $familyId,
        ?int $distributionId = null
    ): QrScan
    {
        return QrScan::create([
            'distribution_id' => $distributionId,
            'family_id'       => $familyId,
            'resource_id'     => $resourceId,
            'resource_label'  => $validated['resource_label'] ?? null,
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
            'family:id,family_id,head_name,purok_id',
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
