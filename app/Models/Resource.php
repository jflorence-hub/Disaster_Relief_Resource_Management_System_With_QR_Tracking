<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Resource extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'category', 'sku', 'qr_code', 'quantity', 'unit',
        'minimum_threshold', 'expiry_date', 'location_id', 'notes',
    ];

    protected $appends = ['status'];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'minimum_threshold' => 'integer',
            'expiry_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Resource $resource) {
            if (empty($resource->sku)) {
                $resource->sku = 'SKU-'.strtoupper(Str::random(8));
            }
            if (empty($resource->qr_code)) {
                $resource->qr_code = 'RES-'.strtoupper(Str::random(10));
            }
        });
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(Distribution::class);
    }

    public function scans(): HasMany
    {
        return $this->hasMany(QrScan::class);
    }

    public function getStatusAttribute(): string
    {
        if ($this->quantity <= 0) {
            return 'out_of_stock';
        }

        if ($this->quantity <= $this->minimum_threshold) {
            return 'low_stock';
        }

        return 'in_stock';
    }
}
