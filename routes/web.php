<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\PasswordRecoveryController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DistributionController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QrTrackingController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ResourceController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\FamilyController;
use App\Http\Controllers\StaffMessageController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware('guest')->group(function () {
    Route::get('login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('login', [AuthenticatedSessionController::class, 'store']);
    Route::get('forgot-password', [
        PasswordRecoveryController::class,
        'create',
    ])->name('password.request');

    Route::post('forgot-password/send-otp', [
        PasswordRecoveryController::class,
        'sendOtp',
    ])->name('password.otp.send');

    Route::post('forgot-password/verify-otp', [
        PasswordRecoveryController::class,
        'verifyOtp',
    ])->name('password.otp.verify');

    Route::post('forgot-password/reset', [
        PasswordRecoveryController::class,
        'resetPassword',
    ])->name('password.reset');


    Route::get('register', [RegisteredUserController::class, 'create'])->name('register');
    Route::post('register', [RegisteredUserController::class, 'store']);
});

Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');

Route::middleware(['auth', 'must.change.password'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('messages', [StaffMessageController::class, 'index'])->name('messages.index');
    Route::post('messages', [StaffMessageController::class, 'store'])->name('messages.store');

    // Announcements
    Route::get('announcements', [AnnouncementController::class, 'index'])->name('announcements.index');
    Route::post('announcements', [AnnouncementController::class, 'store'])->name('announcements.store');

    // Profile
    Route::get('profile', [ProfileController::class, 'show'])->name('profile.show');
    Route::post('profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('profile/avatar', [ProfileController::class, 'uploadAvatar'])->name('profile.avatar');
    Route::post('profile/password', [ProfileController::class, 'changePassword'])->name('profile.password');

    Route::resource('locations', LocationController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    Route::resource('families', FamilyController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    Route::resource('resources', ResourceController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    Route::resource('distribution', DistributionController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    Route::put(
        'distribution-schedule',
        [DistributionController::class, 'updateSchedule']
    )->name('distribution.schedule.update');
    
    Route::put('distribution-schedule', [DistributionController::class, 'updateSchedule'])->name('distribution.schedule.update');

    Route::get('qr-tracking', [QrTrackingController::class, 'index'])->name('qr-tracking.index');
    Route::post('qr-tracking/lookup', [QrTrackingController::class, 'lookup'])->name('qr-tracking.lookup');
    Route::post('qr-tracking', [QrTrackingController::class, 'store'])->name('qr-tracking.store');
    Route::delete('qr-tracking/{qrScan}', [QrTrackingController::class, 'destroy'])->name('qr-tracking.destroy');

    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('reports/export/families', [ReportController::class, 'exportFamilies'])->name('reports.export.families');
    Route::get('reports/export/inventory', [ReportController::class, 'exportInventory'])->name('reports.export.inventory');
    Route::get('reports/export/distributions', [ReportController::class, 'exportDistributions'])->name('reports.export.distributions');
    Route::get('reports/export/qr-scans', [ReportController::class, 'exportQrScans'])->name('reports.export.qr-scans');


    // Administrator-only areas
    Route::middleware('admin')->group(function () {
        Route::resource('team', TeamController::class)
            ->parameters(['team' => 'user'])
            ->only(['index', 'store', 'update', 'destroy']);

        Route::post('team/{user}/approve', [TeamController::class, 'approve'])->name('team.approve');
        Route::post('team/{user}/reject', [TeamController::class, 'reject'])->name('team.reject');

        Route::get('settings', [SettingController::class, 'index'])->name('settings.index');
        Route::patch('settings/profile', [SettingController::class, 'updateProfile'])->name('settings.profile');
        Route::put('settings/password', [SettingController::class, 'updatePassword'])->name('settings.password');
        Route::put('settings/system', [SettingController::class, 'updateSystem'])->name('settings.system');
        Route::post('settings/backup', [SettingController::class, 'createBackup'])->name('settings.backup.create');
        Route::get('settings/backup/{filename}/download', [SettingController::class, 'downloadBackup'])->name('settings.backup.download');
        Route::delete('settings/backup/{filename}', [SettingController::class, 'deleteBackup'])->name('settings.backup.delete');
        Route::post('settings/restore', [SettingController::class, 'restoreBackup'])->name('settings.restore');
    });
});
