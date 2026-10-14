<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Purok;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function create(): Response
    {
        $puroks = Purok::select('id', 'name', 'code')
            ->where('status', 'active')
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

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'phone'    => $request->phone,
            'password' => Hash::make(Str::random(16)),
            'purok_id' => $request->purok_id,
            'role'     => 'staff',
            'status'   => 'pending',
        ]);

        $purokName = Purok::find($request->purok_id)->name;
        $admin = User::where('role', 'admin')->orderBy('id')->first();

        if ($admin) {
            Mail::raw(
                "A new staff registration request has been submitted.\n\n"
                . "Name:  {$user->name}\n"
                . "Email: {$user->email}\n"
                . "Phone: " . ($user->phone ?? 'N/A') . "\n"
                . "Purok: {$purokName}\n\n"
                . "Please log in to the admin panel to approve or reject this request.",
                function ($message) use ($admin) {
                    $message->to($admin->email)->subject('New Staff Registration Request');
                }
            );
        }

        return redirect()->route('login')->with(
            'status',
            'Your registration request has been submitted. You will receive an email once an admin approves your account.'
        );
    }
}
