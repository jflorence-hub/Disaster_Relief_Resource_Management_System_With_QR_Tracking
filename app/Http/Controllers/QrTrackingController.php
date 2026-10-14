<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\Location;
use App\Models\QrScan;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
                'family:id,family_id,family_name,head_name,purok_id',
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

                    'family' => $scan->family ? [
                        'id'          => $scan->family->id,
                        'family_id'   => $scan->family->family_id,
                        'family_name' => $scan->family->family_name,
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

        return Inertia::render('qr-tracking', [
            'scans'    => $scans,
            'userRole' => $user->role,

            'families' => Family::select('id', 'family_id', 'family_name', 'head_name', 'purok_id')
                ->with('purok:id,name')
                ->where('status', 'active')
                ->orderBy('family_name')
                ->get()
                ->map(fn ($f) => [
                    'id'          => $f->id,
                    'family_id'   => $f->family_id,
                    'family_name' => $f->family_name,
                    'head_name'   => $f->head_name,
                    'purok'       => $f->purok?->name,
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
            'scan_type'       => 'required|in:check_in,check_out,audit,transfer',
            'quantity_change'  => 'required|integer|min:1',
            'scan_date'       => 'nullable|date',
            'scan_time'       => 'nullable|string|max:10',
        ]);

        QrScan::create([
            'family_id'       => $data['family_id'] ?? null,
            'location_id'     => $data['location_id'] ?? null,
            'scanned_by'      => $request->user()?->id,
            'scan_type'       => $data['scan_type'],
            'quantity_change' => (int) $data['quantity_change'],
            'scanned_at'      => now(),
            'scan_date'       => $data['scan_date'] ?? now()->toDateString(),
            'scan_time'       => $data['scan_time'] ?? now()->format('H:i'),
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
