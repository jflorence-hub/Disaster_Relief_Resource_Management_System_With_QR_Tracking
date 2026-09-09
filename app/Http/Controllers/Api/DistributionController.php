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
     * Look up a family's distribution record by its QR code, so field
     * staff can check whether — and what — a family has already received
     * before handing out more relief.
     */
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
