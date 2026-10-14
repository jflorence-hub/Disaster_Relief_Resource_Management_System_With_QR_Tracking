<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffMessage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffMessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $staff = $request->user();

        $messages = StaffMessage::with(['sender:id,name,role', 'recipient:id,name,role'])
            ->where(function ($q) use ($staff) {
                $q->where('sender_id', $staff->id)
                  ->orWhere('recipient_id', $staff->id);
            })
            ->orderBy('created_at')
            ->get();

        return response()->json(['messages' => $messages]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string',
        ]);

        $staff = $request->user();
        $admin = User::where('role', 'admin')->orderBy('id')->first();

        if (! $admin) {
            return response()->json(['message' => 'No administrator found.'], 422);
        }

        $staffMessage = StaffMessage::create([
            'sender_id'    => $staff->id,
            'recipient_id' => $admin->id,
            'message'      => $validated['message'],
        ]);

        $staffMessage->load(['sender:id,name,role', 'recipient:id,name,role']);

        return response()->json(['message' => $staffMessage], 201);
    }
}
