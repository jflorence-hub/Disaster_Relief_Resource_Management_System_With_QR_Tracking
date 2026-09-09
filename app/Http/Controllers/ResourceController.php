<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\Resource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ResourceController extends Controller
{
    public function index(Request $request): Response
    {
        $resources = Resource::query()
            ->with('location:id,name,city')
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%")
                        ->orWhere('qr_code', 'like', "%{$search}%");
                });
            })
            ->when($request->string('category')->toString(), fn ($query, $category) => $query->where('category', $category))
            ->when($request->string('location_id')->toString(), fn ($query, $locationId) => $query->where('location_id', $locationId))
            ->orderBy('name')
            ->get();

        return Inertia::render('resources', [
            'resources' => $resources,
            'locations' => Location::select('id', 'name')->orderBy('name')->get(),
            'filters' => $request->only(['search', 'category', 'location_id']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Resource::create($this->validated($request));

        return back()->with('success', 'Resource created successfully.');
    }

    public function update(Request $request, Resource $resource): RedirectResponse
    {
        $resource->update($this->validated($request, $resource));

        return back()->with('success', 'Resource updated successfully.');
    }

    public function destroy(Resource $resource): RedirectResponse
    {
        $resource->delete();

        return back()->with('success', 'Resource deleted successfully.');
    }

    private function validated(Request $request, ?Resource $resource = null): array
    {
        return $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|in:food,water,medical,shelter,clothing,hygiene,tools,set,other',
            'sku' => 'nullable|string|max:100|unique:resources,sku'.($resource ? ",{$resource->id}" : ''),
            'quantity' => 'required|integer|min:0',
            'unit' => 'required|string|max:50',
            'minimum_threshold' => 'required|integer|min:0',
            'expiry_date' => 'nullable|date',
            'location_id' => 'nullable|exists:locations,id',
            'notes' => 'nullable|string',
        ]);
    }
}
