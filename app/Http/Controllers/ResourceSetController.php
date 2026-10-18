<?php

namespace App\Http\Controllers;

use App\Models\Resource;
use App\Models\ResourceSet;
use App\Models\ResourceSetItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ResourceSetController extends Controller
{
    /**
     * Store a newly created resource set.
     *
     * Validates num_sets, checks stock sufficiency (hard block if insufficient),
     * deducts stock from each resource inside a transaction.
     */
    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Only administrators can manage resource sets.');

        $data    = $this->validateSetRequest($request);
        $numSets = (int) ($data['num_sets'] ?? 1);

        // Stock sufficiency check — hard block
        $shortfall = $this->checkStock($data['items'], $numSets, $data['location_id']);
        if (! empty($shortfall)) {
            return back()->withErrors(['stock' => $this->formatShortfall($shortfall)])->withInput();
        }

        DB::transaction(function () use ($request, $data, $numSets) {
            $set = ResourceSet::create([
                'name'           => $data['name'],
                'description'    => $data['description'] ?? null,
                'location_id'    => $data['location_id'],
                'disaster'       => $data['disaster'] ?? null,
                'created_by'     => $request->user()->id,
                'num_sets'       => $numSets,
                'sets_remaining' => $numSets,
            ]);

            foreach ($data['items'] as $item) {
                ResourceSetItem::create([
                    'resource_set_id' => $set->id,
                    'resource_id'     => $item['resource_id'],
                    'quantity'        => $item['quantity'],
                ]);

                // Deduct total qty (qty_per_set × num_sets) from resource stock
                Resource::where('id', $item['resource_id'])
                    ->decrement('quantity', $item['quantity'] * $numSets);
            }
        });

        return redirect()->route('resources.index')
            ->with('success', "Resource set created successfully ({$numSets} sets produced).");
    }

    /**
     * Update an existing resource set.
     *
     * If num_sets increases: check stock for the difference and deduct it.
     * If num_sets decreases: restore the difference to stock.
     */
    public function update(Request $request, ResourceSet $resourceSet): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Only administrators can manage resource sets.');

        $data       = $this->validateSetRequest($request);
        $newNumSets = (int) ($data['num_sets'] ?? 1);
        $oldNumSets = (int) $resourceSet->num_sets;
        $diff       = $newNumSets - $oldNumSets;

        if ($diff > 0) {
            // Need more sets — check & deduct the additional stock
            $shortfall = $this->checkStock($data['items'], $diff, $data['location_id']);
            if (! empty($shortfall)) {
                return back()->withErrors(['stock' => $this->formatShortfall($shortfall)])->withInput();
            }
        }

        DB::transaction(function () use ($data, $resourceSet, $newNumSets, $diff) {
            $resourceSet->update([
                'name'           => $data['name'],
                'description'    => $data['description'] ?? null,
                'location_id'    => $data['location_id'],
                'disaster'       => $data['disaster'] ?? null,
                'num_sets'       => $newNumSets,
                'sets_remaining' => max(0, (int) ($resourceSet->sets_remaining ?? $newNumSets) + $diff),
            ]);

            // Adjust stock for the difference in num_sets
            if ($diff !== 0) {
                foreach ($data['items'] as $item) {
                    if ($diff > 0) {
                        Resource::where('id', $item['resource_id'])
                            ->decrement('quantity', $item['quantity'] * $diff);
                    } else {
                        Resource::where('id', $item['resource_id'])
                            ->increment('quantity', $item['quantity'] * abs($diff));
                    }
                }
            }

            // Full replacement of items
            $resourceSet->items()->delete();
            foreach ($data['items'] as $item) {
                ResourceSetItem::create([
                    'resource_set_id' => $resourceSet->id,
                    'resource_id'     => $item['resource_id'],
                    'quantity'        => $item['quantity'],
                ]);
            }
        });

        return redirect()->route('resources.index')
            ->with('success', 'Resource set updated successfully.');
    }

    /**
     * Delete a resource set.
     */
    public function destroy(Request $request, ResourceSet $resourceSet): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Only administrators can manage resource sets.');

        $activeCount = $resourceSet->distributions()
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        if ($activeCount > 0) {
            return back()->withErrors([
                'resource_set' => "Cannot delete: {$activeCount} active distribution(s) reference this set.",
            ])->withInput();
        }

        DB::transaction(function () use ($resourceSet) {
            $resourceSet->items()->delete();
            $resourceSet->delete();
        });

        return redirect()->route('resources.index')
            ->with('success', 'Resource set deleted successfully.');
    }

    // ─── Private helpers ───────────────────────────────────────────────────

    /**
     * Check whether enough stock exists for num_sets × each item's quantity.
     * Returns an array of shortfall descriptions; empty array = all OK.
     */
    private function checkStock(array $items, int $numSets, mixed $locationId): array
    {
        $shortfalls = [];

        foreach ($items as $item) {
            $needed   = $item['quantity'] * $numSets;
            $resource = Resource::where('id', $item['resource_id'])
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->first(['id', 'name', 'quantity', 'unit']);

            if (! $resource) {
                $shortfalls[] = "Resource #{$item['resource_id']} not found at the selected location.";
                continue;
            }

            if ($resource->quantity < $needed) {
                $maxSets = $item['quantity'] > 0
                    ? (int) floor($resource->quantity / $item['quantity'])
                    : 0;

                $shortfalls[] = "{$resource->name}: need {$needed} {$resource->unit} "
                    . "({$numSets} sets × {$item['quantity']}), "
                    . "only {$resource->quantity} available (max {$maxSets} sets possible).";
            }
        }

        return $shortfalls;
    }

    private function formatShortfall(array $shortfalls): string
    {
        return 'Insufficient stock: ' . implode(' | ', $shortfalls);
    }

    /**
     * Shared validation rules for store() and update().
     */
    private function validateSetRequest(Request $request): array
    {
        return $request->validate([
            'name'                => ['required', 'string', 'max:255'],
            'description'         => ['nullable', 'string', 'max:1000'],
            'location_id'         => ['required', 'exists:locations,id'],
            'disaster'            => [
                'nullable',
                'string',
                'in:' . implode(',', ResourceController::DISASTER_TYPES),
            ],
            'num_sets'            => ['nullable', 'integer', 'min:1', 'max:10000'],
            'items'               => ['required', 'array', 'min:1'],
            'items.*.resource_id' => ['required', 'exists:resources,id'],
            'items.*.quantity'    => ['required', 'integer', 'min:1'],
        ]);
    }
}
