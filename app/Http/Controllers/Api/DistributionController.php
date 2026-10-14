<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DistributionController extends Controller
{
    /**
     * Look up a distribution record by QR code and return the associated
     * family details for the scan confirmation form.
     */
    public function lookupByQr(Request $request): JsonResponse
    {
        $request->validate(['qr_code' => 'required|string']);

        $distribution = Distribution::with([
            'resource:id,name,unit',
            'additionalResource:id,name,unit',
            'location:id,name',
            'family:id,family_id,family_name,head_name,phone,household_member,purok_id,location_id',
            'family.purok:id,name',
            'family.location:id,name',
        ])
            ->where('qr_code', trim($request->string('qr_code')))
            ->first();

        if (! $distribution) {
            return response()->json([
                'found'   => false,
                'message' => 'No family found for QR code.',
            ], 404);
        }

        return response()->json([
            'found'        => true,
            'distribution' => $distribution,
            'family'       => $distribution->family,
        ]);
    }

    /**
     * Return family relief distributions scoped to this staff member's purok.
     * Also returns schedule groups for the distribution history filter dropdown.
     */
    public function history(Request $request): JsonResponse
    {
        $staff = $request->user();

        $distributions = Distribution::with([
            'resource:id,name,unit',
            'additionalResource:id,name,unit',
            'location:id,name',
            'family:id,family_id,family_name,head_name,purok_id',
            'family.purok:id,name',
            'distributor:id,name',
        ])
            // Scope to families in this staff member's assigned purok
            ->whereHas('family', fn ($q) => $q->where('purok_id', $staff->purok_id))
            ->orderByDesc('distribution_date')
            ->get();

        // Build schedule groups for the dropdown
        $schedules = $distributions->map(fn ($d) => [
            'date'          => $d->distribution_date?->toDateString(),
            'resource_name' => $d->resource?->name,
            'location_name' => $d->location?->name,
        ])->unique(fn ($s) => implode('|', array_values($s)))->values();

        return response()->json([
            'distributions' => $distributions,
            'schedules'     => $schedules,
        ]);
    }
    public function lookup(Request $request): JsonResponse
    {
        $request->validate(['qr_code' => 'required|string']);

        $distribution = Distribution::with([
            'resource:id,name,unit',
            'additionalResource:id,name,unit',
            'location:id,name',
        ])
            ->where('qr_code', trim($request->string('qr_code')))
            ->first();

        if (! $distribution) {
            return response()->json([
                'found' => false,
                'message' => 'No distribution record matches this QR code.',
            ], 404);
        }

        return response()->json([
            'found' => true,
            'distribution' => $distribution,
        ]);
    }

    /**
     * Mark a pending / in-transit distribution as completed the moment a
     * family actually receives their goods in the field, deducting stock
     * at that point. Refuses to double-process an already-completed
     * record, which is what actually prevents duplicate relief.
     */
    public function confirm(Request $request): JsonResponse
    {
        $data = $request->validate([
            'qr_code' => 'required|string|exists:distributions,qr_code',
        ]);

        $distribution = Distribution::with([
            'resource:id,name,unit',
            'additionalResource:id,name,unit',
            'location:id,name',
        ])->where('qr_code', $data['qr_code'])->firstOrFail();

        if ($distribution->status === 'completed') {
            return response()->json([
                'message' => 'This family already received this relief distribution.',
                'distribution' => $distribution,
                'already_completed' => true,
            ], 409);
        }

        if ($distribution->status === 'cancelled') {
            return response()->json([
                'message' => 'This distribution record was cancelled and cannot be confirmed.',
                'distribution' => $distribution,
            ], 422);
        }

        DB::transaction(function () use ($distribution) {
            $distribution->applyStock();
            $distribution->status = 'completed';
            $distribution->save();
        });

        return response()->json([
            'message' => 'Confirmed. Distribution marked as completed.',
            'distribution' => $distribution->fresh(['resource:id,name,unit', 'additionalResource:id,name,unit', 'location:id,name']),
        ]);
    }
}
