<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DisasterEvent extends Model
{
    use HasFactory;

    public const TYPES = [
        'Typhoon',
        'Flood',
        'Earthquake',
        'Volcanic Eruption',
        'Landslide',
        'Tsunami',
        'Storm Surge',
        'Drought',
        'Wildfire',
        'Tornado',
        'Hurricane',
        'Cyclone',
        'Flash Flood',
        'Mudslide',
        'Hailstorm',
        'Blizzard',
        'Heat Wave',
        'Cold Wave',
        'Industrial Accident',
        'Oil Spill',
        'Pandemic / Disease Outbreak',
        'Other',
    ];

    protected $fillable = [
        'name',
        'type',
        'affected_area',
        'starts_on',
        'ends_on',
        'status',
        'description',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(DistributionSchedule::class);
    }
}
