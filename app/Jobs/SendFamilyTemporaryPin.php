<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

class SendFamilyTemporaryPin implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public int $deliveryId)
    {
    }

    public function backoff(): array
    {
        return [60, 300];
    }

    public function handle(): void
    {
        $delivery = DB::table('family_credential_deliveries')->where('id', $this->deliveryId)->first();
        if (! $delivery || $delivery->status === 'sent') {
            return;
        }
        if (! $delivery->pin_encrypted) {
            throw new RuntimeException('Temporary PIN is unavailable for delivery.');
        }

        $mailer = config('mail.default');
        if (in_array($mailer, ['log', 'array', 'failover'], true)) {
            throw new RuntimeException('Configure a real mail transport before sending family credentials.');
        }

        DB::table('family_credential_deliveries')->where('id', $this->deliveryId)->update([
            'status' => 'sending',
            'attempts' => DB::raw('attempts + 1'),
            'last_error' => null,
            'updated_at' => now(),
        ]);

        $family = DB::table('families')
            ->join('family_credential_deliveries', 'family_credential_deliveries.family_id', '=', 'families.id')
            ->leftJoin('locations', 'locations.id', '=', 'families.location_id')
            ->leftJoin('puroks', 'puroks.id', '=', 'families.purok_id')
            ->where('family_credential_deliveries.id', $this->deliveryId)
            ->first([
                'families.head_name',
                'families.must_change_pin',
                'locations.name as barangay_name',
                'puroks.name as purok_name',
                'family_credential_deliveries.recipient_email',
            ]);

        if (! $family) {
            throw new RuntimeException('Family account was not found for credential delivery.');
        }
        if (! $family->must_change_pin) {
            DB::table('family_credential_deliveries')->where('id', $this->deliveryId)->update([
                'status' => 'superseded',
                'pin_encrypted' => null,
                'last_error' => null,
                'updated_at' => now(),
            ]);
            return;
        }

        $pin = Crypt::decryptString($delivery->pin_encrypted);
        Mail::raw(
            "Dear {$family->head_name},\n\n"
            . "Your family has been registered in the Barangay Household Portal.\n\n"
            . "Your temporary PIN is: {$pin}\n\n"
            . "Please log in using your email ({$family->recipient_email}) and this PIN. "
            . "You will be asked to change it after logging in.\n\n"
            . "Barangay: {$family->barangay_name}\n"
            . "Purok: {$family->purok_name}",
            function ($message) use ($family) {
                $message->to($family->recipient_email)
                    ->subject('Your Family Portal PIN - Barangay Household Information');
            }
        );

        DB::table('family_credential_deliveries')->where('id', $this->deliveryId)->update([
            'status' => 'sent',
            'pin_encrypted' => null,
            'last_error' => null,
            'sent_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function failed(?Throwable $exception): void
    {
        DB::table('family_credential_deliveries')->where('id', $this->deliveryId)->update([
            'status' => 'failed',
            'last_error' => 'Email delivery failed after automatic retries. Check SMTP settings and queue worker logs.',
            'updated_at' => now(),
        ]);
    }
}
