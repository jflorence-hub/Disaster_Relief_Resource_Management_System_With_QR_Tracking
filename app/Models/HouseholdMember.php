<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HouseholdMember extends Model
{
    protected $fillable = [
        'family_id',
        'household_member_number',
        'name',
    ];

    /**
     * Returns the member's name or a generated label when no name is stored.
     */
    public function getDisplayNameAttribute(): string
    {
        return $this->name ?? "Member #{$this->household_member_number}";
    }

    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }
}
