<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QrScan extends Model
{
    use HasFactory;

    protected $fillable = [
        'resource_id',
        'destination_resource_id',

        'family_id',

        'location_id',
        'from_location_id',
        'to_location_id',

        'scanned_by',

        'scan_type',
        'recipient_name',
        'receiver',
        'quantity_change',
        'notes',
        'scanned_at',

        'scan_date',
        'scan_time',
    ];

    protected function casts(): array
    {
        return [
            'quantity_change' => 'integer',
            'scanned_at'      => 'datetime',
            'scan_date'       => 'date',
        ];
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(
            Resource::class
        );
    }

    public function destinationResource(): BelongsTo
    {
        return $this->belongsTo(
            Resource::class,
            'destination_resource_id'
        );
    }

    public function family(): BelongsTo
    {
        return $this->belongsTo(
            Family::class
        );
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(
            Location::class
        );
    }

    public function fromLocation(): BelongsTo
    {
        return $this->belongsTo(
            Location::class,
            'from_location_id'
        );
    }

    public function toLocation(): BelongsTo
    {
        return $this->belongsTo(
            Location::class,
            'to_location_id'
        );
    }

    public function scanner(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'scanned_by'
        );
    }
}
