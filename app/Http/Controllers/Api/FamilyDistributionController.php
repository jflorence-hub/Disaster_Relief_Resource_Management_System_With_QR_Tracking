<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FamilyDistributionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $family = $request->user();

        $distributions = Distribution::with([
            'resource:id,name,unit',
            'additionalResource:id,name,unit',
            'location:id,name',
        ])
            ->where('family_id', $family->id)
            ->orderByDesc('distribution_date')
            ->get();

        return response()->json([
            'family' => [
                'id' => $family->id,
                'family_id' => $family->family_id,
                'family_name' => $family->family_name,
                'location_id' => $family->location_id,
            ],
            'distributions' => $distributions,
        ]);
    }

    public function confirm(Request $request, Distribution $item): JsonResponse
    {
        abort_unless($item->family_id === $request->user()->id, 403);

        if ($item->status === 'completed') {
            return response()->json([
                'message' => 'This distribution is already completed.',
                'distribution' => $item->load('resource:id,name,unit', 'additionalResource:id,name,unit', 'location:id,name'),
            ], 409);
        }

        if ($item->status === 'cancelled') {
            return response()->json([
                'message' => 'This distribution was cancelled.',
            ], 422);
        }

        $item->applyStock();
        $item->update(['status' => 'completed']);

        return response()->json([
            'message' => 'Distribution confirmed.',
            'distribution' => $item->fresh([
                'resource:id,name,unit',
                'additionalResource:id,name,unit',
                'location:id,name',
            ]),
        ]);
    }
}
