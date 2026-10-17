<?php

namespace App\Console\Commands;

use App\Models\Family;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class BackfillFamilyQrCodes extends Command
{
    protected $signature = 'families:backfill-qr';
    protected $description = 'Generate qr_code for families that do not have one yet';

    public function handle(): void
    {
        $count = 0;
        Family::whereNull('qr_code')->orderBy('id')->each(function (Family $family) use (&$count) {
            do {
                $candidate = 'FAM-QR-' . strtoupper(Str::random(10));
            } while (Family::where('qr_code', $candidate)->exists());

            $family->update(['qr_code' => $candidate]);
            $count++;
        });

        $this->info("Done. {$count} families updated.");
    }
}