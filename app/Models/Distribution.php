<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Distribution extends Model
{
    use HasFactory;

    protected $fillable = [
        'resource_id',
        'additional_resource_id',
        'location_id',
        'distributed_by',
        'quantity',
        'additional_quantity',
        'recipient_name',
        'recipient_contact',
        'household_member',
        'distribution_date',
        'status',
        'notes',
        'family_id',
        'schedule_id',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'additional_quantity' => 'integer',
            'household_member' => 'integer',
            'distribution_date' => 'datetime',
        ];
    }

    /**
     * Automatically generate the QR code
     * whenever a distribution is created.
     */
    protected static function booted(): void
    {
        static::creating(
            function (
                Distribution $distribution
            ) {
                if (
                    empty(
                        $distribution->qr_code
                    )
                ) {
                    $distribution->qr_code =
                        'DIST-' .
                        strtoupper(
                            Str::random(10)
                        );
                }
            }
        );
    }

    /**
     * Family that owns this distribution.
     */
    public function family(): BelongsTo
    {
        return $this->belongsTo(
            Family::class
        );
    }

    /**
     * Main relief resource.
     */
    public function resource(): BelongsTo
    {
        return $this->belongsTo(
            Resource::class
        );
    }

    /**
     * Optional additional resource.
     */
    public function additionalResource(): BelongsTo
    {
        return $this->belongsTo(
            Resource::class,
            'additional_resource_id'
        );
    }

    /**
     * Distribution location.
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(
            Location::class
        );
    }

    /**
     * User who distributed/created it.
     */
    public function distributor(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'distributed_by'
        );
    }

    /**
     * Deduct stock.
     */
    public function applyStock(): void
    {
        Resource::whereKey(
            $this->resource_id
        )->decrement(
            'quantity',
            $this->quantity
        );

        if (
            $this->additional_resource_id &&
            $this->additional_quantity
        ) {
            Resource::whereKey(
                $this->additional_resource_id
            )->decrement(
                'quantity',
                $this->additional_quantity
            );
        }
    }

    /**
     * Restore stock.
     */
    public function reverseStock(): void
    {
        Resource::whereKey(
            $this->resource_id
        )->increment(
            'quantity',
            $this->quantity
        );

        if (
            $this->additional_resource_id &&
            $this->additional_quantity
        ) {
            Resource::whereKey(
                $this->additional_resource_id
            )->increment(
                'quantity',
                $this->additional_quantity
            );
        }
    }
}