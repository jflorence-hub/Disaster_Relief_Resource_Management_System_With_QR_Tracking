<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Purok extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::creating(function (Purok $purok) {
            if (empty($purok->code)) {
                $prefix = $purok->location_id ? "LOC-{$purok->location_id}-" : '';
                $purok->code = $prefix . Str::upper(Str::slug($purok->name, '-'));
            }
        });
    }

    protected $fillable = [
        'name',
        'code',
        'location_id',
        'assigned_staff_id',
        'status',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_staff_id');
    }

    public function families(): HasMany
    {
        return $this->hasMany(Family::class);
    }
}
