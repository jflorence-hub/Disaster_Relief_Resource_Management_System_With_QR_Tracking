<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Beneficiary extends Model
{
    protected $fillable = [
        'family_id',
        'beneficiary_number',
    ];

    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }
}