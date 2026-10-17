<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DistributionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'distribution_id',
        'resource_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
        ];
    }

    public function distribution(): BelongsTo
    {
        return $this->belongsTo(Distribution::class);
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(Resource::class);
    }
}
