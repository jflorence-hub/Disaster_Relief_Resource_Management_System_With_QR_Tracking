<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Resource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResourceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $staff = $request->user();

        $resources = Resource::with('location:id,name')
            ->where('location_id', $staff->location_id)
            ->orderBy('name')
            ->get();

        return response()->json(['resources' => $resources]);
    }
}
