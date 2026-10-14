<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
    ];

    protected $hidden = [
        'pin',
        'api_token',
    ];

    /**
     * Family's Purok.
     */
    public function purok(): BelongsTo
    {
        return $this->belongsTo(
            Purok::class
        );
    }

    /**
     * Family's location.
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(
            Location::class
        );
    }

    /**
     * Family's distribution records.
     */
    public function distributions(): HasMany
    {
        return $this->hasMany(
            Distribution::class
        );
    }

    /**
     * Family beneficiaries.
     */
    public function household_member(): HasMany
    {
        return $this->hasMany(
            HouseholdMember::class
        );
    }
}