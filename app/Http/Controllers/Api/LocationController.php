<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use Illuminate\Http\JsonResponse;

class LocationController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'locations' => Location::select('id', 'name', 'type', 'city', 'status')
                ->where('status', '!=', 'inactive')
                ->orderBy('name')
                ->get(),
        ]);
    }
}
