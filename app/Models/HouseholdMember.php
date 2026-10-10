<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HouseholdMember extends Model
{
    protected $fillable = [
        'family_id',
        'household_member_number',
    ];

    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }
}