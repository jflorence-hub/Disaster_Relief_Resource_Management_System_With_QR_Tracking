<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\QrScan;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class QrTrackingController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isAdmin = $user->role === 'admin';
        $scans = QrScan::query()
            ->when(!$isAdmin, fn ($q) => $q->where('scanned_by', $user->id))
            ->with([
                'resource:id,name,qr_code,unit',
                'location:id,name',
                'fromLocation:id,name',
                'toLocation:id,name',
                'destinationResource:id,name,qr_code,unit,location_id',
                'scanner:id,name',
            ])
            ->orderByDesc('scanned_at')
            ->limit(200)
            ->get()
            ->map(function (QrScan $scan) {
                /*
                 * Explicitly expose the relationships using the exact
                 * names expected by the React page.
                 */
                return [
                    'id' => $scan->id,

                    'resource_id' => $scan->resource_id,

                    'destination_resource_id' =>
                        $scan->destination_resource_id,

                    'location_id' =>
                        $scan->location_id,

                    'from_location_id' =>
                        $scan->from_location_id,

                    'to_location_id' =>
                        $scan->to_location_id,

                    'scan_type' =>
                        $scan->scan_type,

                    'recipient_name' =>
                        $scan->recipient_name,

                    'quantity_change' =>
                        $scan->quantity_change,

                    'notes' =>
                        $scan->notes,

                    'scanned_at' =>
                        $scan->scanned_at,

                    /*
                     * RESOURCE
                     */
                    'resource' => $scan->resource
                        ? [
                            'id' =>
                                $scan->resource->id,

                            'name' =>
                                $scan->resource->name,

                            'qr_code' =>
                                $scan->resource->qr_code,

                            'unit' =>
                                $scan->resource->unit,
                        ]
                        : null,

                    /*
                     * SOURCE / FROM LOCATION
                     */
                    'from_location' => $scan->fromLocation
                        ? [
                            'id' =>
                                $scan->fromLocation->id,

                            'name' =>
                                $scan->fromLocation->name,
                        ]
                        : null,

                    /*
                     * DESTINATION / TO LOCATION
                     */
                    'to_location' => $scan->toLocation
                        ? [
                            'id' =>
                                $scan->toLocation->id,

                            'name' =>
                                $scan->toLocation->name,
                        ]
                        : null,

                    /*
                     * CURRENT/COMPATIBILITY LOCATION
                     */
                    'location' => $scan->location
                        ? [
                            'id' =>
                                $scan->location->id,

                            'name' =>
                                $scan->location->name,
                        ]
                        : null,

                    /*
                     * DESTINATION RESOURCE
                     */
                    'destination_resource' =>
                        $scan->destinationResource
                            ? [
                                'id' =>
                                    $scan->destinationResource->id,

                                'name' =>
                                    $scan->destinationResource->name,

                                'qr_code' =>
                                    $scan->destinationResource->qr_code,

                                'unit' =>
                                    $scan->destinationResource->unit,

                                'location_id' =>
                                    $scan->destinationResource->location_id,
                            ]
                            : null,

                    /*
                     * USER WHO SCANNED
                     */
                    'scanner' => $scan->scanner
                        ? [
                            'id' =>
                                $scan->scanner->id,

                            'name' =>
                                $scan->scanner->name,
                        ]
                        : null,
                ];
            });

        return Inertia::render('qr-tracking', [
            'scans' => $scans,
            'userRole' => $user->role,

            /*
             * Only resources with available stock can be scanned.
             */
            'resources' => Resource::select(
                'id',
                'name',
                'qr_code',
                'quantity',
                'unit',
                'location_id'
            )
                ->with('location:id,name')
                ->when(!$isAdmin, fn ($q) => $q->where('location_id', $user->location_id))
                ->where('quantity', '>', 0)
                ->orderBy('name')
                ->get(),

            /*
             * Available locations.
             */
            'locations' => Location::select(
                'id',
                'name',
                'contact_person'
            )
                ->when(!$isAdmin && $user->location_id, fn ($q) => $q->whereKey($user->location_id))
                ->orderBy('name')
                ->get(),

            /*
             * Purok handlers — staff with an assigned purok, for the receiver dropdown.
             * Each entry includes the purok name and location_id so the frontend can
             * filter them when a destination location is selected.
             */
            'purokHandlers' => \App\Models\User::where('role', 'staff')
                ->whereNotNull('purok_id')
                ->with('location:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'purok_id', 'location_id'])
                ->map(fn ($u) => [
                    'id'          => $u->id,
                    'name'        => $u->name,
                    'purok_id'    => $u->purok_id,
                    'location_id' => $u->location_id,
                    'location_name' => $u->location?->name,
                ]),
        ]);
    }


    public function lookup(Request $request): JsonResponse
    {
        $request->validate([
            'qr_code' => 'required|string',
        ]);

        $resource = Resource::with(
            'location:id,name'
        )
            ->where(
                'qr_code',
                $request->string('qr_code')->trim()
            )
            ->first();

        $lastScan = $resource
            ? QrScan::where(
                'resource_id',
                $resource->id
            )
                ->with([
                    'location:id,name',
                    'fromLocation:id,name',
                    'toLocation:id,name',
                ])
                ->orderByDesc('scanned_at')
                ->first()
            : null;

        return response()->json([
            'resource' => $resource,
            'last_scan' => $lastScan,
        ]);
    }


    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'qr_code' => [
                'required',
                'string',
                'exists:resources,qr_code',
            ],

            /*
             * Kept for frontend compatibility.
             *
             * NEVER trusted as the source.
             */
            'location_id' => [
                'nullable',
                'exists:locations,id',
            ],

            /*
             * Destination.
             */
            'to_location_id' => [
                'nullable',
                'exists:locations,id',
            ],

            'scan_type' => [
                'required',
                'in:check_in,check_out,audit,transfer',
            ],

            'recipient_name' => [
                'nullable',
                'string',
                'max:255',
            ],

            'quantity_change' => [
                'required',
                'integer',
                'min:1',
            ],

            'notes' => [
                'nullable',
                'string',
            ],
        ]);

        DB::transaction(function () use ($data, $request) {

            /*
             * Find the scanned resource and lock it.
             */
            $resource = Resource::where(
                'qr_code',
                $data['qr_code']
            )
                ->lockForUpdate()
                ->firstOrFail();

            $scanType = $data['scan_type'];

            $quantity = (int) $data['quantity_change'];

            /*
             * IMPORTANT:
             *
             * Get the SOURCE before changing anything.
             */
            $sourceId = $resource->location_id;

            // Staff may scan only stock at their assigned location.
            if ($request->user()->role === 'staff' && $request->user()->location_id !== null && (int) $sourceId !== (int) $request->user()->location_id) {
                abort(403, 'You can only record QR transactions for resources at your assigned location.');
            }

            /*
             * Destination supplied by user.
             */
            $destinationId =
                !empty($data['to_location_id'])
                    ? (int) $data['to_location_id']
                    : null;


            /*
             * ==========================================================
             * AUDIT
             * ==========================================================
             *
             * Audit does not change inventory.
             */
            if ($scanType === 'audit') {

                $this->createScan(
                    resource: $resource,
                    data: $data,
                    request: $request,
                    sourceId: $sourceId,
                    destinationId: null,
                    quantityChange: 0,
                    destinationResourceId: null
                );

                return;
            }


            /*
             * ==========================================================
             * CHECK OUT
             * ==========================================================
             */
            if ($scanType === 'check_out') {

                if (!$sourceId) {
                    abort(
                        422,
                        'The selected resource has no current location.'
                    );
                }

                if ($quantity > $resource->quantity) {
                    abort(
                        422,
                        "Insufficient stock. {$resource->name} has only {$resource->quantity} {$resource->unit} available."
                    );
                }

                /*
                 * Remove stock from current location.
                 */
                $resource->decrement(
                    'quantity',
                    $quantity
                );

                /*
                 * Save:
                 *
                 * FROM = current location
                 * TO   = null
                 */
                $this->createScan(
                    resource: $resource,
                    data: $data,
                    request: $request,
                    sourceId: $sourceId,
                    destinationId: null,
                    quantityChange: -$quantity,
                    destinationResourceId: null
                );

                return;
            }


            /*
             * ==========================================================
             * CHECK IN / TRANSFER
             * ==========================================================
             */
            if (
                in_array(
                    $scanType,
                    ['check_in', 'transfer'],
                    true
                )
            ) {

                /*
                 * Destination required.
                 */
                if (!$destinationId) {
                    abort(
                        422,
                        'Select a destination location.'
                    );
                }

                /*
                 * Source required.
                 */
                if (!$sourceId) {
                    abort(
                        422,
                        'The selected resource has no current location.'
                    );
                }

                /*
                 * Cannot move to same location.
                 */
                if (
                    (int) $sourceId ===
                    (int) $destinationId
                ) {
                    abort(
                        422,
                        'The destination must be different from the current location.'
                    );
                }

                /*
                 * Check stock.
                 */
                if ($quantity > $resource->quantity) {
                    abort(
                        422,
                        "Insufficient stock. {$resource->name} has only {$resource->quantity} {$resource->unit} available."
                    );
                }


                /*
                 * ======================================================
                 * STEP 1
                 * Remove from SOURCE.
                 * ======================================================
                 */
                $resource->decrement(
                    'quantity',
                    $quantity
                );


                /*
                 * ======================================================
                 * STEP 2
                 * Find same resource at destination.
                 * ======================================================
                 */
                $destinationResource = Resource::where(
                    'name',
                    $resource->name
                )
                    ->where(
                        'category',
                        $resource->category
                    )
                    ->where(
                        'unit',
                        $resource->unit
                    )
                    ->where(
                        'location_id',
                        $destinationId
                    )
                    ->lockForUpdate()
                    ->first();


                /*
                 * ======================================================
                 * STEP 3
                 * Add to destination.
                 * ======================================================
                 */
                if ($destinationResource) {

                    $destinationResource->increment(
                        'quantity',
                        $quantity
                    );

                } else {

                    /*
                     * Create destination inventory.
                     *
                     * Do NOT duplicate QR code.
                     */
                    $destinationResource = Resource::create([
                        'name' =>
                            $resource->name,

                        'category' =>
                            $resource->category,

                        'sku' =>
                            null,

                        'qr_code' =>
                            null,

                        'quantity' =>
                            $quantity,

                        'unit' =>
                            $resource->unit,

                        'minimum_threshold' =>
                            $resource->minimum_threshold,

                        'expiry_date' =>
                            $resource->expiry_date,

                        'location_id' =>
                            $destinationId,

                        'notes' =>
                            $resource->notes,
                    ]);
                }


                /*
                 * ======================================================
                 * STEP 4
                 * SAVE SOURCE + DESTINATION.
                 * ======================================================
                 */
                $this->createScan(
                    resource: $resource,
                    data: $data,
                    request: $request,

                    /*
                     * FROM
                     */
                    sourceId: $sourceId,

                    /*
                     * TO
                     */
                    destinationId: $destinationId,

                    /*
                     * Stock left source.
                     */
                    quantityChange: -$quantity,

                    /*
                     * Destination resource record.
                     */
                    destinationResourceId:
                        $destinationResource->id
                );
            }
        });

        return back()->with(
            'success',
            'Scan recorded and inventory updated successfully.'
        );
    }


    /**
     * Save QR tracking history.
     */
    private function createScan(
        Resource $resource,
        array $data,
        Request $request,
        ?int $sourceId,
        ?int $destinationId,
        int $quantityChange,
        ?int $destinationResourceId
    ): QrScan {

        /*
         * THIS IS THE IMPORTANT PART.
         *
         * from_location_id = SOURCE
         * to_location_id   = DESTINATION
         */
        return QrScan::create([
            'resource_id' =>
                $resource->id,

            'destination_resource_id' =>
                $destinationResourceId,

            /*
             * Compatibility field.
             *
             * Keep it as SOURCE.
             */
            'location_id' =>
                $sourceId,

            /*
             * Explicit FROM.
             */
            'from_location_id' =>
                $sourceId,

            /*
             * Explicit TO.
             *
             * NULL for Check Out/Audit.
             */
            'to_location_id' =>
                $destinationId,

            'scanned_by' =>
                $request->user()?->id,

            'scan_type' =>
                $data['scan_type'],

            'recipient_name' =>
                $data['recipient_name'] ?? null,

            'quantity_change' =>
                $quantityChange,

            'notes' =>
                $data['notes'] ?? null,

            'scanned_at' =>
                now(),
        ]);
    }


    /**
     * Delete QR scan history.
     */
    public function destroy(Request $request, QrScan $qrScan): RedirectResponse {
        abort_unless($request->user()->role === 'admin', 403, 'Only administrators can delete scan history.');
        $qrScan->delete();

        return back()->with(
            'success',
            'Scan record deleted. Inventory changes are not reversed automatically.'
        );
    }
}