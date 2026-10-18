<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\QrScan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FamilyDistributionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $family = $request->user();
        $family->loadMissing(['purok:id,name', 'location:id,name']);

        $distributions = Distribution::with([
            'resource:id,name,unit',
            'additionalResource:id,name,unit',
            'location:id,name',
            'distributor:id,name',
        ])
            ->where('family_id', $family->id)
            ->orderByDesc('distribution_date')
            ->get();

        // Enrich each distribution with the receiver from the linked QR scan
        $distributions->each(function (Distribution $d) {
            if ($d->qr_code) {
                $scan = \App\Models\QrScan::where(function ($q) use ($d) {
                    $q->where('family_id', $d->family_id)
                      ->whereNotNull('receiver');
                })
                ->orderByDesc('scanned_at')
                ->first(['receiver', 'scanned_at']);

                if ($scan && $scan->receiver) {
                    $d->claimed_by = $scan->receiver;
                }
            }
            // Fallback: if claimed_by is still empty, use the head of family (set at distribution level)
        });

        $householdMembers = $family->household_member()
            ->orderBy('household_member_number')
            ->get(['id', 'household_member_number', 'name'])
            ->map(fn ($m) => [
                'id'     => $m->id,
                'number' => $m->household_member_number,
                'name'   => $m->display_name,
            ]);

        return response()->json([
            'family' => [
                'id'               => $family->id,
                'family_id'        => $family->family_id,
                'head_name'        => $family->head_name,
                'household_member' => $family->household_member,
                'purok'            => $family->purok ? $family->purok->name : null,
                'location'         => $family->location
                    ? ['id' => $family->location->id, 'name' => $family->location->name]
                    : null,
            ],
            'distributions'    => $distributions,
            'household_members' => $householdMembers,
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
