<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\HouseholdMember;
use App\Models\QrScan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FamilyDistributionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $family = $request->user();
        $family->loadMissing(['purok:id,name', 'location:id,name']);

        $distributions = Distribution::with([
            'resource:id,name,unit',
            'resourceSet:id,name',
            'additionalResource:id,name,unit',
            'location:id,name',
            'distributor:id,name',
            'schedule.disasterEvent:id,name,type,affected_area',
        ])
            ->where('family_id', $family->id)
            ->orderByDesc('distribution_date')
            ->get();

        // Keep scan details tied to this distribution, not another schedule for the same family.
        $distributions->each(function (Distribution $d) {
            $windowError = $d->claimWindowError();
            $d->setAttribute(
                'claim_window_open',
                $d->status === 'pending' && ! $d->excluded && $windowError === null
            );
            $d->setAttribute('claim_window_message', $windowError);

            $scan = QrScan::with('scanner:id,name')
                ->where('distribution_id', $d->id)
                ->where('scan_type', 'completed')
                ->orderByDesc('scanned_at')
                ->first(['receiver', 'scanned_by', 'scanned_at']);

            $d->setAttribute('receiver', null);
            $d->setAttribute('scanned_by', null);

            if ($scan) {
                $d->setAttribute('receiver', $scan->receiver);
                $d->setAttribute('scanned_by', $scan->scanner?->name);
            }
        });
        $authenticatedMember = $request->attributes->get('authenticated_household_member');

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
            'authenticated_member' => $authenticatedMember ? [
                'id' => $authenticatedMember->id,
                'name' => $authenticatedMember->display_name,
            ] : null,
        ]);
    }

    public function confirm(Request $request, Distribution $item): JsonResponse
    {
        abort_unless($item->family_id === $request->user()->id, 403);

        $authenticatedMember = $request->attributes->get('authenticated_household_member');
        abort_unless(
            $authenticatedMember instanceof HouseholdMember &&
                (int) $authenticatedMember->family_id === (int) $request->user()->id,
            403,
            'Only a registered household member account can confirm receipt.'
        );

        DB::transaction(function () use ($item, $authenticatedMember) {
            $distribution = Distribution::query()->lockForUpdate()->findOrFail($item->id);

            abort_if($distribution->excluded, 422, 'This family is excluded from the distribution.');
            abort_unless($distribution->status === 'pending', 422, 'This distribution is not awaiting confirmation.');
            $windowError = $distribution->claimWindowError();
            abort_if($windowError !== null, 422, $windowError);

            $distribution->applyStock();
            $distribution->update([
                'status' => 'completed',
                'claimed_by' => $authenticatedMember->display_name,
            ]);
        });

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
