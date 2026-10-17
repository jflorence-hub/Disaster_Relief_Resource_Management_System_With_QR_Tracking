<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResourceSetItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'resource_set_id',
        'resource_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
        ];
    }

    public function resourceSet(): BelongsTo
    {
        return $this->belongsTo(ResourceSet::class);
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(Resource::class);
    }
}
