<?php

use App\Http\Controllers\Api\AdminStaffController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DistributionController;
use App\Http\Controllers\Api\FamilyAuthController;
use App\Http\Controllers\Api\FamilyDistributionController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\FamilyMessageController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\QrTrackingController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ResourceController;
use App\Http\Controllers\Api\StaffFamilyController;
use App\Http\Controllers\Api\StaffMessageController;
use Illuminate\Support\Facades\Route;

// Staff self-registration
Route::post('register', [AuthController::class, 'register']);

// Password reset
Route::post('password/forgot', [AuthController::class, 'forgotPassword']);
Route::post('password/verify-otp', [AuthController::class, 'verifyOtp']);
Route::post('password/reset', [AuthController::class, 'resetPassword']);

// Public authentication routes
Route::post('login', [AuthController::class, 'login']);

Route::post('family/register', [FamilyAuthController::class, 'register']);
Route::post('family/login', [FamilyAuthController::class, 'login']);
Route::post('family/forgot-password', [FamilyAuthController::class, 'forgotPassword']);
Route::post('family/reset-password', [FamilyAuthController::class, 'resetPassword']);

// Public registration and location options
Route::get('puroks', [LocationController::class, 'registrationOptions']);
Route::get('locations', [LocationController::class, 'index']);

// Staff API routes
Route::middleware(['auth.token', 'auth.staff'])->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);

    Route::get('staff/families', [StaffFamilyController::class, 'index']);
    Route::post('staff/families/register', [StaffFamilyController::class, 'registerFamily']);
    Route::get('families/{family}/members', [StaffFamilyController::class, 'members']);

    // Distribution
    Route::get('distributions/history', [DistributionController::class, 'history']);
    Route::post('distributions/lookup', [DistributionController::class, 'lookup']);
    Route::post('distributions/confirm', [DistributionController::class, 'confirm']);
    Route::post('distributions/lookup-by-qr', [DistributionController::class, 'lookupByQr']);

    // QR tracking
    Route::post('qr/lookup', [QrTrackingController::class, 'lookup']);
    Route::post('qr/scan', [QrTrackingController::class, 'store']);
    Route::get('qr/scans', [QrTrackingController::class, 'index']);

    // Resources
    Route::get('resources', [ResourceController::class, 'index']);

    // Reports
    Route::get('reports', [ReportController::class, 'index']);

    // Staff messages
    Route::get('messages', [StaffMessageController::class, 'index']);
    Route::post('messages', [StaffMessageController::class, 'store']);

    // Announcements for staff
    Route::get('announcements', [AnnouncementController::class, 'staffIndex']);

    // Profile
    Route::patch('profile', [ProfileController::class, 'update']);
    Route::post('profile/avatar', [ProfileController::class, 'uploadAvatar']);
});

// Family API routes
Route::middleware('auth.family')->group(function () {
    Route::get('family/me', [FamilyAuthController::class, 'me']);
    Route::post('family/logout', [FamilyAuthController::class, 'logout']);

    Route::get('family/messages', [FamilyMessageController::class, 'index']);
    Route::post('family/messages', [FamilyMessageController::class, 'store']);

    Route::get('family/distributions', [FamilyDistributionController::class, 'index']);
    Route::post('family/distributions/{item}/confirm', [FamilyDistributionController::class, 'confirm']);

    // Announcements for family/household
    Route::get('family/announcements', [AnnouncementController::class, 'familyIndex']);
});

// Admin API routes
Route::middleware(['auth.token', 'auth.admin'])->group(function () {
    Route::get('admin/pending-staff', [AdminStaffController::class, 'pendingStaff']);
    Route::post('admin/approve-staff/{user}', [AdminStaffController::class, 'approveStaff']);
    Route::post('admin/reject-staff/{user}', [AdminStaffController::class, 'rejectStaff']);
});