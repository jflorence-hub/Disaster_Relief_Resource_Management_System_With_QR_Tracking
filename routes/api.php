<?php
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DistributionController;
use App\Http\Controllers\Api\FamilyAuthController;
use App\Http\Controllers\Api\FamilyDistributionController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\QrTrackingController;
use App\Http\Controllers\Api\StaffFamilyController;
use Illuminate\Support\Facades\Route;
Route::post('login',[AuthController::class,'login']);
Route::post('family/register',[FamilyAuthController::class,'register']);
Route::post('family/login',[FamilyAuthController::class,'login']);
Route::get('locations',[LocationController::class,'index']);
Route::middleware(['auth.token','auth.staff'])->group(function(){
 Route::get('me',[AuthController::class,'me']); Route::post('logout',[AuthController::class,'logout']);
 Route::get('staff/families',[StaffFamilyController::class,'index']);
 Route::get('distributions/history',[DistributionController::class,'history']);
 Route::post('distributions/lookup',[DistributionController::class,'lookup']);
 Route::post('distributions/confirm',[DistributionController::class,'confirm']);
 Route::post('qr/lookup',[QrTrackingController::class,'lookup']); Route::post('qr/scan',[QrTrackingController::class,'store']); Route::get('qr/scans',[QrTrackingController::class,'index']);
});
Route::middleware('auth.family')->group(function(){
 Route::get('family/me',[FamilyAuthController::class,'me']); Route::post('family/logout',[FamilyAuthController::class,'logout']);
 Route::get('family/distributions',[FamilyDistributionController::class,'index']); Route::post('family/distributions/{item}/confirm',[FamilyDistributionController::class,'confirm']);
});
