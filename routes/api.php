<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DistributionController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\QrTrackingController;
use Illuminate\Support\Facades\Route;

// Public — used by the Flutter mobile app to sign in and obtain a token.
Route::post('login', [AuthController::class, 'login']);

// Token-protected — everything the mobile app does after signing in.
Route::middleware('auth.token')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);

    Route::post('qr/lookup', [QrTrackingController::class, 'lookup']);
    Route::post('qr/scan', [QrTrackingController::class, 'store']);
    Route::get('qr/scans', [QrTrackingController::class, 'index']);

    Route::post('distributions/lookup', [DistributionController::class, 'lookup']);
    Route::post('distributions/confirm', [DistributionController::class, 'confirm']);

    Route::get('locations', [LocationController::class, 'index']);
});
