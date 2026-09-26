<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DistributionController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\QrTrackingController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ResourceController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\FamilyController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware('guest')->group(function () {
    Route::get('login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('login', [AuthenticatedSessionController::class, 'store']);

    Route::get('register', [RegisteredUserController::class, 'create'])->name('register');
    Route::post('register', [RegisteredUserController::class, 'store']);
});

Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');

Route::middleware('auth')->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::resource('locations', LocationController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    Route::resource('families', FamilyController::class)
    ->only(['index', 'store', 'update', 'destroy']);

    Route::resource('resources', ResourceController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    Route::resource('distribution', DistributionController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    Route::get('qr-tracking', [QrTrackingController::class, 'index'])->name('qr-tracking.index');
    Route::post('qr-tracking/lookup', [QrTrackingController::class, 'lookup'])->name('qr-tracking.lookup');
    Route::post('qr-tracking', [QrTrackingController::class, 'store'])->name('qr-tracking.store');
    Route::delete('qr-tracking/{qrScan}', [QrTrackingController::class, 'destroy'])->name('qr-tracking.destroy');

    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('reports/export/inventory', [ReportController::class, 'exportInventory'])->name('reports.export.inventory');
    Route::get('reports/export/distributions', [ReportController::class, 'exportDistributions'])->name('reports.export.distributions');
    Route::get('reports/export/qr-scans', [ReportController::class, 'exportQrScans'])->name('reports.export.qr-scans');

    // Administrator-only areas
    Route::middleware('admin')->group(function () {
        Route::resource('team', TeamController::class)
            ->parameters(['team' => 'user'])
            ->only(['index', 'store', 'update', 'destroy']);

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
