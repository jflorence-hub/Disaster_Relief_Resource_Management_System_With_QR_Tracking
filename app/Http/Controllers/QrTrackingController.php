<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Models\Family;
use App\Models\Location;
use App\Models\QrScan;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class QrTrackingController extends Controller
{
    public function index(Request $request): Response
    {
        $user    = $request->user();
        $isAdmin = $user->role === 'admin';

        $scans = QrScan::query()
            ->when(!$isAdmin, fn ($q) => $q->where('scanned_by', $user->id))
            ->with([
                'family:id,family_id,head_name,purok_id',
                'family.purok:id,name',
                'resource:id,name,qr_code,unit',
                'location:id,name',
                'scanner:id,name',
            ])
            ->orderByDesc('scanned_at')
            ->limit(200)
            ->get()
            ->map(function (QrScan $scan) {
                return [
                    'id'              => $scan->id,
                    'family_id'       => $scan->family_id,
                    'location_id'     => $scan->location_id,
                    'scanned_by'      => $scan->scanned_by,
                    'scan_type'       => $scan->scan_type,
                    'quantity_change' => $scan->quantity_change,
                    'scanned_at'      => $scan->scanned_at,
                    'scan_date'       => $scan->scan_date?->format('Y-m-d'),
                    'scan_time'       => $scan->scan_time,
                    'receiver'        => $scan->receiver,

                    'family' => $scan->family ? [
                        'id'          => $scan->family->id,
                        'family_id'   => $scan->family->family_id,
                        'head_name'   => $scan->family->head_name,
                        'purok'       => $scan->family->purok?->name,
                    ] : null,

                    'resource' => $scan->resource ? [
                        'id'      => $scan->resource->id,
                        'name'    => $scan->resource->name,
                        'qr_code' => $scan->resource->qr_code,
                        'unit'    => $scan->resource->unit,
                    ] : null,

                    'location' => $scan->location ? [
                        'id'   => $scan->location->id,
                        'name' => $scan->location->name,
                    ] : null,

                    'scanner' => $scan->scanner ? [
                        'id'   => $scan->scanner->id,
                        'name' => $scan->scanner->name,
                    ] : null,
                ];
            });

        // ── Distribution history for the calendar tab ───────────────────────
        $scheduleHistory = DB::table('distribution_schedules as s')
            ->leftJoin('resources as r', 'r.id', '=', 's.resource_id')
            ->leftJoin('locations as l', 'l.id', '=', 's.location_id')
            ->orderByDesc('s.scheduled_at')
            ->get(['s.id', 's.scheduled_at', 'r.name as resource_name', 'l.name as location_name'])
            ->map(function ($schedule) use ($user) {
                $dists = DB::table('distributions as d')
                    ->join('families as f', 'f.id', '=', 'd.family_id')
                    ->leftJoin('puroks as p',     'p.id', '=', 'f.purok_id')
                    ->leftJoin('resources as r2', 'r2.id', '=', 'd.resource_id')
                    ->leftJoin('users as u',      'u.id',  '=', 'd.distributed_by')
                    ->leftJoin('qr_scans as q',   function ($join) {
                        $join->on('q.family_id', '=', 'f.id')
                              ->where('q.scan_type', 'completed');
                    })
                    ->where('d.schedule_id', $schedule->id)
                    ->when($user->role === 'staff', fn ($q) => $q->where('f.purok_id', $user->purok_id))
                    ->get([
                        'd.id', 'd.status', 'd.excluded', 'd.exclusion_reason',
                        'd.quantity', 'f.family_id as family_code',
                        'f.head_name', 'f.location_id',
                        'p.name as purok_name',
                        'r2.name as resource_name', 'r2.unit as resource_unit',
                        'u.name as scanned_by',
                        'q.receiver', 'q.scanned_at as scan_time',
                    ]);

                return [
                    'id'            => $schedule->id,
                    'scheduled_at'  => $schedule->scheduled_at,
                    'resource_name' => $schedule->resource_name,
                    'location_name' => $schedule->location_name,
                    'families'      => $dists,
                ];
            });

        return Inertia::render('qr-tracking', [
            'scans'          => $scans,
            'userRole'       => $user->role,
            'scheduleHistory' => $scheduleHistory,
            'allLocations'   => \App\Models\Location::where('status', 'active')->orderBy('name')->get(['id', 'name']),

            'families' => Family::select('id', 'family_id', 'head_name', 'purok_id')
                ->with([
                    'purok:id,name',
                    'distributions' => fn ($q) => $q
                        ->with('resource:id,name,unit')
                        ->whereNotIn('status', ['cancelled'])
                        ->orderByDesc('distribution_date')
                        ->limit(1),
                ])
                ->where('status', 'active')
                ->orderBy('head_name')
                ->get()
                ->map(fn ($f) => [
                    'id'                  => $f->id,
                    'family_id'           => $f->family_id,
                    'head_name'           => $f->head_name,
                    'purok'               => $f->purok?->name,
                    'latest_distribution' => $f->distributions->first() ? [
                        'resource' => $f->distributions->first()->resource ? [
                            'id'   => $f->distributions->first()->resource->id,
                            'name' => $f->distributions->first()->resource->name,
                            'unit' => $f->distributions->first()->resource->unit,
                        ] : null,
                    ] : null,
                ]),

            'locations' => Location::select('id', 'name', 'contact_person')
                ->when(!$isAdmin && $user->location_id, fn ($q) => $q->whereKey($user->location_id))
                ->orderBy('name')
                ->get(),
        ]);
    }


    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'qr_code'         => 'nullable|string',
            'family_id'       => 'nullable|exists:families,id',
            'location_id'     => 'nullable|exists:locations,id',
            'scan_type'       => 'required|in:released,returned,verified',
            'quantity_change'  => 'required|integer|min:1',
            'scan_date'       => 'nullable|date',
            'scan_time'       => 'nullable|string|max:10',
            'receiver'        => 'nullable|string|max:255',
        ]);

        // Resolve resource_id from the family's latest pending distribution
        $resourceId = null;
        if (! empty($data['family_id'])) {
            $dist = \App\Models\Distribution::where('family_id', $data['family_id'])
                ->whereNotIn('status', ['cancelled'])
                ->orderByDesc('distribution_date')
                ->first(['resource_id']);
            $resourceId = $dist?->resource_id;
        }

        QrScan::create([
            'family_id'       => $data['family_id'] ?? null,
            'resource_id'     => $resourceId,
            'location_id'     => $data['location_id'] ?? null,
            'scanned_by'      => $request->user()?->id,
            'scan_type'       => $data['scan_type'],
            'quantity_change' => (int) $data['quantity_change'],
            'scanned_at'      => now(),
            'scan_date'       => $data['scan_date'] ?? now()->toDateString(),
            'scan_time'       => $data['scan_time'] ?? now()->format('H:i'),
            'receiver'        => $data['receiver'] ?? null,
        ]);

        return back()->with('success', 'Scan recorded successfully.');
    }


    /**
     * Delete QR scan history.
     */
    public function destroy(Request $request, QrScan $qrScan): RedirectResponse
    {
        abort_unless(
            $request->user()->role === 'admin',
            403,
            'Only administrators can delete scan history.'
        );

        $qrScan->delete();

        return back()->with('success', 'Scan record deleted.');
    }
}
