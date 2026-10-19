<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ResourceSet extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'location_id',
        'created_by',
        'num_sets',
        'sets_remaining',
    ];

    /** Location this set is scoped to. */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /** Admin who created this set. */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Line items (resource + quantity pairs). */
    public function items(): HasMany
    {
        return $this->hasMany(ResourceSetItem::class);
    }

    /** Distributions that reference this set. */
    public function distributions(): HasMany
    {
        return $this->hasMany(Distribution::class);
    }
}
