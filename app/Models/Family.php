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
        'family_name',
        'head_name',
        'phone',
        'email',
        'household_member',
        'address',
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

    /**
     * Auto-generate a unique QR code when a family is created.
     */
    protected static function booted(): void
    {
        static::creating(function (Family $family) {
            if (empty($family->qr_code)) {
                do {
                    $candidate = 'FAM-QR-' . strtoupper(Str::random(10));
                } while (static::where('qr_code', $candidate)->exists());

                $family->qr_code = $candidate;
            }
        });
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