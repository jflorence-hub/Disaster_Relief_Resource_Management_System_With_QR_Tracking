<?php

namespace App\Http\Controllers;

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
     * NOTE: Full implementation is added by task 2.1.
     * This stub delegates to the shared validateSetRequest() helper
     * so that update() (task 2.5) can already use it without duplication.
     */
    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Only administrators can manage resource sets.');

        $data = $this->validateSetRequest($request);

        DB::transaction(function () use ($request, $data) {
            $set = ResourceSet::create([
                'name'        => $data['name'],
                'description' => $data['description'] ?? null,
                'location_id' => $data['location_id'],
                'disaster'    => $data['disaster'] ?? null,
                'created_by'  => $request->user()->id,
            ]);

            foreach ($data['items'] as $item) {
                ResourceSetItem::create([
                    'resource_set_id' => $set->id,
                    'resource_id'     => $item['resource_id'],
                    'quantity'        => $item['quantity'],
                ]);
            }
        });

        return redirect()->route('resources.index')
            ->with('success', 'Resource set created successfully.');
    }

    /**
     * Update an existing resource set.
     *
     * Validates the same rules as store(), then performs a full
     * delete-and-replace of the set's items within a transaction.
     */
    public function update(Request $request, ResourceSet $resourceSet): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Only administrators can manage resource sets.');

        $data = $this->validateSetRequest($request);

        DB::transaction(function () use ($data, $resourceSet) {
            $resourceSet->update([
                'name'        => $data['name'],
                'description' => $data['description'] ?? null,
                'location_id' => $data['location_id'],
                'disaster'    => $data['disaster'] ?? null,
            ]);

            // Full replacement: wipe existing items and re-insert submitted ones.
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
     *
     * NOTE: Full implementation is added by task 2.7.
     * Blocked if any non-completed/non-cancelled distributions reference this set.
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

    /**
     * Shared validation rules for store() and update().
     *
     * Centralised here so both methods stay in sync if the rules ever change.
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
            'items'               => ['required', 'array', 'min:1'],
            'items.*.resource_id' => ['required', 'exists:resources,id'],
            'items.*.quantity'    => ['required', 'integer', 'min:1'],
        ]);
    }
}
