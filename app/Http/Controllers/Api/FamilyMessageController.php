<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FamilyMessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $family = $request->user();
        $rows = DB::table('family_messages')->where('family_id', $family->id)->orderBy('created_at')->get();
        DB::table('family_messages')->where('family_id', $family->id)->where('sender_type', 'admin')->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['messages' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['message' => 'required|string|max:5000']);
        $family = $request->user();
        $id = DB::table('family_messages')->insertGetId([
            'family_id' => $family->id, 'admin_id' => null, 'sender_type' => 'family',
            'message' => $data['message'], 'created_at' => now(), 'updated_at' => now(),
        ]);
        return response()->json(['message' => 'Message sent to the administrator.', 'item' => DB::table('family_messages')->find($id)], 201);
    }
}
