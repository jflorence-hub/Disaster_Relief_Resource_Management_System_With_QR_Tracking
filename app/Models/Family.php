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
        'beneficiary_count',
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

    public function beneficiaries(): HasMany
    {
        return $this->hasMany(Beneficiary::class);
    }
}
