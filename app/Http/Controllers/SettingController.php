<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Models\Location;
use App\Models\QrScan;
use App\Models\Resource;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use ZipArchive;

class SettingController extends Controller
{
    private const KEYS = ['app_name', 'organization_contact_email', 'organization_phone', 'low_stock_default_threshold'];

    public function index(Request $request): Response
    {
        $settings = collect(self::KEYS)->mapWithKeys(fn ($key) => [$key => Setting::get($key)]);

        $backups = collect(Storage::disk('local')->files('backups'))
            ->filter(fn ($path) => str_ends_with($path, '.zip'))
            ->map(fn ($path) => [
                'name' => basename($path),
                'size' => Storage::disk('local')->size($path),
                'created_at' => Storage::disk('local')->lastModified($path),
            ])
            ->sortByDesc('created_at')
            ->values();

        return Inertia::render('settings', [
            'user' => $request->user(),
            'settings' => $settings,
            'backups' => $backups,
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,'.$user->id,
            'phone' => 'nullable|string|max:50',
        ]);

        $user->update($data);

        return back()->with('success', 'Profile updated successfully.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => 'required|current_password',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user->update(['password' => Hash::make($data['password'])]);

        return back()->with('success', 'Password updated successfully.');
    }

    public function updateSystem(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'app_name' => 'required|string|max:255',
            'organization_contact_email' => 'nullable|email|max:255',
            'organization_phone' => 'nullable|string|max:50',
            'low_stock_default_threshold' => 'required|integer|min:0',
        ]);

        foreach ($data as $key => $value) {
            Setting::set($key, (string) $value);
        }

        return back()->with('success', 'System settings updated successfully.');
    }

    public function createBackup(): RedirectResponse
    {
        $tables = [
            'locations' => Location::all()->toArray(),
            'resources' => Resource::all()->toArray(),
            'distributions' => Distribution::all()->toArray(),
            'qr_scans' => QrScan::all()->toArray(),
            'users' => User::all()->toArray(),
            'settings' => Setting::all()->toArray(),
        ];

        $json = json_encode([
            'created_at' => now()->toIso8601String(),
            'tables' => $tables,
        ], JSON_PRETTY_PRINT);

        $filename = 'backup-'.now()->format('Y-m-d_His').'.zip';
        Storage::disk('local')->makeDirectory('backups');
        $zipPath = Storage::disk('local')->path('backups/'.$filename);

        $zip = new ZipArchive;
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('data.json', $json);
        $zip->close();

        return back()->with('success', "Backup \"{$filename}\" created successfully.");
    }

    public function downloadBackup(string $filename)
    {
        $path = 'backups/'.basename($filename);

        if (! Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return Storage::disk('local')->download($path);
    }

    public function deleteBackup(string $filename): RedirectResponse
    {
        Storage::disk('local')->delete('backups/'.basename($filename));

        return back()->with('success', 'Backup deleted.');
    }

    public function restoreBackup(Request $request): RedirectResponse
    {
        $request->validate([
            'backup_file' => 'required|file|mimes:zip',
        ]);

        $uploaded = $request->file('backup_file');
        $tmpZip = $uploaded->getRealPath();

        $zip = new ZipArchive;
        if ($zip->open($tmpZip) !== true) {
            return back()->with('error', 'Could not open the uploaded backup file.');
        }

        $json = $zip->getFromName('data.json');
        $zip->close();

        if (! $json) {
            return back()->with('error', 'The backup file is not valid.');
        }

        $payload = json_decode($json, true);
        $tables = $payload['tables'] ?? null;

        if (! $tables) {
            return back()->with('error', 'The backup file has no data to restore.');
        }

        DB::transaction(function () use ($tables) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');

            foreach (['qr_scans', 'distributions', 'resources', 'users', 'locations', 'settings'] as $table) {
                DB::table($table)->truncate();
            }

            foreach (['locations', 'users', 'resources', 'distributions', 'qr_scans', 'settings'] as $table) {
                foreach ($tables[$table] ?? [] as $row) {
                    DB::table($table)->insert($row);
                }
            }

            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        });

        return back()->with('success', 'Data restored successfully from backup.');
    }
}
