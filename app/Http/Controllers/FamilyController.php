<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\Purok;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\User;
use App\Models\Beneficiary;

class FamilyController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $families = Family::query()
            ->with('purok:id,name')
            ->when(
                $user->role === 'staff',
                fn($query) =>
                    $query->where('purok_id', $user->purok_id)
            )
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('family_id', 'like', "%{$search}%")
                        ->orWhere('family_name', 'like', "%{$search}%")
                        ->orWhere('head_name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->orderBy('family_name')
            ->get();

        $puroks = Purok::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $staff = User::query()
            ->where('role', 'staff')
            ->whereNotNull('purok_id')
            ->orderBy('name')
            ->get(['id', 'name', 'purok_id']);

        return Inertia::render('families', [
            'families' => $families,
            'puroks' => $puroks,
            'staff' => $staff,
            'filters' => $request->only(['search']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'family_id' => 'required|string|max:50|unique:families,family_id',
            'family_name' => 'required|string|max:255',
            'head_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'beneficiary_count' => 'required|integer|min:1',
            'address' => 'nullable|string',
            'purok_id' => 'required|exists:puroks,id',
            'pin' => 'required|string|min:4|max:20',
            'status' => 'required|in:active,inactive',
        ]);

        // Staff can only create families inside their own Purok.
        if ($user->role === 'staff' && (int) $data['purok_id'] !== (int) $user->purok_id) {
            abort(403, 'You can only manage families in your assigned Purok.');
        }

        $data['pin'] = Hash::make($data['pin']);

        $family = Family::create($data);

        $this->syncBeneficiaries($family);

        return back()->with('success', 'Family added successfully.');
    }

    private function syncBeneficiaries(Family $family): void
    {
        $count = (int) $family->beneficiary_count;

        // Remove the existing beneficiary records
        $family->beneficiaries()->delete();

        // Create the required number of beneficiary records
        for ($i = 1; $i <= $count; $i++) {
            $family->beneficiaries()->create([
                'beneficiary_number' => $i,
            ]);
        }
    }

    public function update(Request $request, Family $family): RedirectResponse
    {
        $user = $request->user();

        if (
            $user->role === 'staff' &&
            (int) $family->purok_id !== (int) $user->purok_id
        ) {
            abort(403);
        }

        $data = $request->validate([
            'family_id' => 'required|string|max:50|unique:families,family_id,' . $family->id,
            'family_name' => 'required|string|max:255',
            'head_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'beneficiary_count' => 'required|integer|min:1',
            'address' => 'nullable|string',
            'purok_id' => 'required|exists:puroks,id',
            'pin' => 'nullable|string|min:4|max:20',
            'status' => 'required|in:active,inactive',
        ]);

        if (
            $user->role === 'staff' &&
            (int) $data['purok_id'] !== (int) $user->purok_id
        ) {
            abort(403, 'You cannot move a family outside your assigned Purok.');
        }

        if (!empty($data['pin'])) {
            $data['pin'] = Hash::make($data['pin']);
        } else {
            unset($data['pin']);
        }

        // Update the family
        $family->update($data);

        // Synchronize beneficiary records
        $family->beneficiaries()->delete();

        for ($i = 1; $i <= (int) $family->beneficiary_count; $i++) {
            $family->beneficiaries()->create([
                'beneficiary_number' => $i,
            ]);
        }

        return back()->with('success', 'Family updated successfully.');
    }

    public function destroy(Request $request, Family $family): RedirectResponse
    {
        $user = $request->user();

        if (
            $user->role === 'staff' &&
            (int) $family->purok_id !== (int) $user->purok_id
        ) {
            abort(403);
        }

        $family->delete();

        return back()->with('success', 'Family deleted successfully.');
    }
}