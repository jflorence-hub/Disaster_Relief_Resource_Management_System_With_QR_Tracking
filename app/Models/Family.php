<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Family extends Authenticatable
{
    use HasFactory;

    protected $fillable = [
        'family_id',
        'head_name',
        'phone',
        'email',
        'household_member',
        'purok_id',
        'location_id',
        'pin',
        'api_token',
        'status',
        'qr_code',
    ];

    protected $hidden = [
        'pin',
        'api_token',
    ];

    protected static function booted(): void
    {
        static::creating(function (Family $family) {
            do {
                $family->family_id = 'TEMP-FAMILY-' . Str::uuid();
            } while (static::where('family_id', $family->family_id)->exists());

            if (empty($family->qr_code)) {
                do {
                    $candidate = 'FAM-QR-' . strtoupper(Str::random(10));
                } while (static::where('qr_code', $candidate)->exists());

                $family->qr_code = $candidate;
            }
        });

        static::created(function (Family $family) {
            $family->forceFill([
                'family_id' => static::generateUniqueFamilyId(),
            ])->saveQuietly();
        });
    }

    public static function generateUniqueFamilyId(): string
    {
        do {
            $letters = '';
            for ($i = 0; $i < 3; $i++) {
                $letters .= chr(random_int(65, 90));
            }
            $candidate = $letters . '-' . str_pad((string) random_int(0, 99999), 5, '0', STR_PAD_LEFT);
        } while (static::where('family_id', $candidate)->exists());

        return $candidate;
    }

    public function purok(): BelongsTo
    {
        return $this->belongsTo(Purok::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(Distribution::class);
    }

    public function household_member(): HasMany
    {
        return $this->hasMany(HouseholdMember::class);
    }
}