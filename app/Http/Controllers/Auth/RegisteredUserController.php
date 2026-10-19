<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Purok;
use App\Models\User;
use App\Services\StaffApprovalService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function __construct(private StaffApprovalService $approvalService)
    {
    }

    public function create(): Response
    {
        $puroks = Purok::with('location:id,name')
            ->select('id', 'name', 'code', 'location_id')
            ->where('status', 'active')
            ->whereNotNull('location_id')
            ->whereHas('location', fn ($query) => $query->where('status', 'active'))
            ->whereIn('name', array_map(fn ($number) => "Purok {$number}", range(1, 7)))
            ->orderBy('name')
            ->get();

        return Inertia::render('register', ['puroks' => $puroks]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|string|lowercase|email|max:255|unique:users,email',
            'phone'    => ['nullable', 'regex:/^09[0-9]{9}$/'],
            'purok_id' => 'required|exists:puroks,id',
        ]);

        $purok = Purok::query()
            ->whereKey($request->purok_id)
            ->where('status', 'active')
            ->whereNotNull('location_id')
            ->whereHas('location', fn ($query) => $query->where('status', 'active'))
            ->whereIn('name', array_map(fn ($number) => "Purok {$number}", range(1, 7)))
            ->first();

        if (! $purok) {
            return back()->withErrors([
                'purok_id' => 'Choose a Purok from an active barangay.',
            ])->withInput();
        }

        $newStaff = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'phone'    => $request->phone,
            'password' => Hash::make(Str::random(16)),
            'purok_id' => $purok->id,
            'location_id' => $purok->location_id,
            'role'     => 'staff',
            'status'   => 'pending',
        ]);

        $newStaff->load('purok:id,name');
        $this->approvalService->notifyAdmins($newStaff);

        return redirect()->route('login')->with(
            'status',
            'Your registration request has been submitted. You will receive an email once an admin approves your account.'
        );
    }
}
