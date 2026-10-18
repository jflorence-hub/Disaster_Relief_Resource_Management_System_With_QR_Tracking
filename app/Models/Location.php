<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::created(function (Location $location) {
            foreach (range(1, 7) as $number) {
                $location->puroks()->firstOrCreate(
                    ['name' => "Purok {$number}"],
                    [
                        'code' => "LOC-{$location->id}-PUROK-{$number}",
                        'status' => 'active',
                    ],
                );
            }
        });
    }

    protected $fillable = [
        'name',
        'type',
        'address',
        'city',
        'latitude',
        'longitude',
        'capacity',
        'contact_person',
        'contact_phone',
        'email',
        'captain_name',
        'captain_contact',
        'captain_email',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'latitude'  => 'decimal:7',
            'longitude' => 'decimal:7',
            'capacity'  => 'integer',
        ];
    }

    public function puroks(): HasMany
    {
        return $this->hasMany(Purok::class);
    }

    public function resources(): HasMany
    {
        return $this->hasMany(Resource::class);
    }

    public function families(): HasMany
    {
        return $this->hasMany(Family::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(Distribution::class);
    }

    public function teamMembers(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function resourceSets(): HasMany
    {
        return $this->hasMany(ResourceSet::class);
    }
}
