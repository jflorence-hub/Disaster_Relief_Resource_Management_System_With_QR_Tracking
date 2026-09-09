<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Models\Location;
use App\Models\Resource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DistributionController extends Controller
{
    public function index(Request $request): Response
    {
        $distributions = Distribution::query()
            ->with([
                'resource:id,name,unit',
                'additionalResource:id,name,unit',
                'location:id,name',
                'distributor:id,name',
            ])
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('recipient_name', 'like', "%{$search}%")
                        ->orWhere('recipient_contact', 'like', "%{$search}%")
                        ->orWhere('qr_code', 'like', "%{$search}%");
                });
            })
            ->when($request->string('status')->toString(), fn ($query, $status) => $query->where('status', $status))
            ->orderByDesc('distribution_date')
            ->get();

        return Inertia::render('distribution', [
            'distributions' => $distributions,
            'resources' => Resource::select('id', 'name', 'category', 'quantity', 'unit')->orderBy('name')->get(),
            'locations' => Location::select('id', 'name')->orderBy('name')->get(),
            'filters' => $request->only(['search', 'status']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        DB::transaction(function () use ($data, $request) {
            $data['distributed_by'] = $request->user()?->id;
            $distribution = Distribution::create($data);

            if ($distribution->status === 'completed') {
                $distribution->applyStock();
            }
        });

        return back()->with('success', 'Distribution recorded successfully.');
    }

    public function update(Request $request, Distribution $distribution): RedirectResponse
    {
        $data = $this->validated($request);

        DB::transaction(function () use ($data, $distribution) {
            // Reverse whatever the record currently accounts for, then
            // reapply based on the new data. This correctly handles every
            // transition (resource changed, additional resource added or
            // removed, status changed) without special-casing each one.
            if ($distribution->status === 'completed') {
                $distribution->reverseStock();
            }

            $distribution->update($data);

            if ($distribution->status === 'completed') {
                $distribution->applyStock();
            }
        });

        return back()->with('success', 'Distribution updated successfully.');
    }

    public function destroy(Distribution $distribution): RedirectResponse
    {
        if ($distribution->status === 'completed') {
            $distribution->reverseStock();
        }

        $distribution->delete();

        return back()->with('success', 'Distribution deleted successfully.');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'resource_id' => 'required|exists:resources,id',
            'additional_resource_id' => 'nullable|exists:resources,id|different:resource_id',
            'location_id' => 'nullable|exists:locations,id',
            'quantity' => 'required|integer|min:1',
            'additional_quantity' => 'nullable|required_with:additional_resource_id|integer|min:1',
            'recipient_name' => 'required|string|max:255',
            'recipient_contact' => 'nullable|string|max:255',
            'beneficiary_count' => 'required|integer|min:1',
            'distribution_date' => 'required|date',
            'status' => 'required|in:pending,in_transit,completed,cancelled',
            'notes' => 'nullable|string',
        ]);
    }
}
