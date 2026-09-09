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
        'resource_id', 'additional_resource_id', 'location_id', 'distributed_by',
        'quantity', 'additional_quantity',
        'recipient_name', 'recipient_contact', 'beneficiary_count',
        'distribution_date', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'additional_quantity' => 'integer',
            'beneficiary_count' => 'integer',
            'distribution_date' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Distribution $distribution) {
            if (empty($distribution->qr_code)) {
                $distribution->qr_code = 'DIST-'.strtoupper(Str::random(10));
            }
        });
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(Resource::class);
    }

    public function additionalResource(): BelongsTo
    {
        return $this->belongsTo(Resource::class, 'additional_resource_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function distributor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'distributed_by');
    }

    /**
     * Deduct this distribution's quantity (and additional quantity, if any)
     * from resource stock. Shared by the web Distribution controller and
     * the mobile app's "confirm" scan action so both go through identical
     * logic.
     */
    public function applyStock(): void
    {
        Resource::whereKey($this->resource_id)->decrement('quantity', $this->quantity);

        if ($this->additional_resource_id && $this->additional_quantity) {
            Resource::whereKey($this->additional_resource_id)->decrement('quantity', $this->additional_quantity);
        }
    }

    /**
     * Restore stock previously deducted by applyStock(). Used when a
     * completed distribution is edited/cancelled/deleted.
     */
    public function reverseStock(): void
    {
        Resource::whereKey($this->resource_id)->increment('quantity', $this->quantity);

        if ($this->additional_resource_id && $this->additional_quantity) {
            Resource::whereKey($this->additional_resource_id)->increment('quantity', $this->additional_quantity);
        }
    }
}
