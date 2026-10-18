<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class Distribution extends Model
{
    use HasFactory;

    protected $fillable = [
        'resource_id',
        'resource_set_id',
        'assignment_mode',
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
        'reason',
        'disaster',
        'family_id',
        'schedule_id',
        'claimed_by',
        'excluded',
        'exclusion_reason',
    ];

    protected function casts(): array
    {
        return [
            'quantity'           => 'integer',
            'additional_quantity' => 'integer',
            'household_member'   => 'integer',
            'distribution_date'  => 'datetime',
            'excluded'           => 'boolean',
            'resource_set_consumed_at' => 'datetime',
        ];
    }

    /**
     * Automatically generate the QR code
     * whenever a distribution is created.
     */
    protected static function booted(): void
    {
        static::creating(function (Distribution $distribution) {
            if (empty($distribution->qr_code)) {
                $distribution->qr_code = 'DIST-' . strtoupper(Str::random(10));
            }
        });
    }

    // --- Relationships --------------------------------------------------------

    /** Family that owns this distribution. */
    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    /** Main relief resource (nullable when a set is used instead). */
    public function resource(): BelongsTo
    {
        return $this->belongsTo(Resource::class);
    }

    /** Optional additional resource. */
    public function additionalResource(): BelongsTo
    {
        return $this->belongsTo(Resource::class, 'additional_resource_id');
    }

    /** Resource set assigned to this distribution (set mode). */
    public function resourceSet(): BelongsTo
    {
        return $this->belongsTo(ResourceSet::class);
    }

    /** Individual resource items (individual mode). */
    public function items(): HasMany
    {
        return $this->hasMany(DistributionItem::class);
    }

    /** Distribution location. */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /** User who distributed/created it. */
    public function distributor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'distributed_by');
    }

    public function claimWindowError(): ?string
    {
        if ($this->status === 'cancelled') {
            return 'This distribution was cancelled.';
        }

        $schedule = $this->schedule_id
            ? DB::table('distribution_schedules')
                ->where('id', $this->schedule_id)
                ->first(['scheduled_at', 'cancelled_at'])
            : null;

        if ($schedule && $schedule->cancelled_at) {
            return 'This distribution schedule was cancelled.';
        }

        $scheduledAt = $schedule?->scheduled_at ?? $this->distribution_date;
        if (! $scheduledAt) {
            return 'This distribution has no valid scheduled time.';
        }

        $startsAt = Carbon::parse($scheduledAt);
        if (now()->lt($startsAt)) {
            return 'This distribution is not open yet.';
        }

        if (now()->gt($startsAt->copy()->addDay())) {
            return 'The 24-hour claim period for this distribution has ended.';
        }

        return null;
    }

    // --- Stock helpers --------------------------------------------------------

    /** Deduct stock for this distribution. */
    public function applyStock(): void
    {
        if ($this->resource_set_id) {
            if ($this->resource_set_consumed_at) {
                return;
            }

            $set = ResourceSet::query()
                ->lockForUpdate()
                ->findOrFail($this->resource_set_id);
            $remaining = (int) ($set->sets_remaining ?? $set->num_sets ?? 0);

            if ($remaining < 1) {
                throw new \RuntimeException("Resource set {$set->name} is out of stock.");
            }

            $set->sets_remaining = $remaining - 1;
            $set->save();
            $this->resource_set_consumed_at = now();
            $this->save();

            return;
        }

        if ($this->resource_id) {
            Resource::whereKey($this->resource_id)
                ->decrement('quantity', $this->quantity);
        }

        if ($this->additional_resource_id && $this->additional_quantity) {
            Resource::whereKey($this->additional_resource_id)
                ->decrement('quantity', $this->additional_quantity);
        }

        // Deduct stock for individually assigned items.
        foreach ($this->items as $item) {
            Resource::whereKey($item->resource_id)
                ->decrement('quantity', $item->quantity);
        }
    }

    /** Restore stock for this distribution (used on reversal). */
    public function reverseStock(): void
    {
        if ($this->resource_set_id) {
            if (! $this->resource_set_consumed_at) {
                return;
            }

            $set = ResourceSet::query()
                ->lockForUpdate()
                ->find($this->resource_set_id);

            if ($set) {
                $set->sets_remaining = (int) ($set->sets_remaining ?? $set->num_sets ?? 0) + 1;
                $set->save();
            }

            $this->resource_set_consumed_at = null;
            $this->save();

            return;
        }

        if ($this->resource_id) {
            Resource::whereKey($this->resource_id)
                ->increment('quantity', $this->quantity);
        }

        if ($this->additional_resource_id && $this->additional_quantity) {
            Resource::whereKey($this->additional_resource_id)
                ->increment('quantity', $this->additional_quantity);
        }

        foreach ($this->items as $item) {
            Resource::whereKey($item->resource_id)
                ->increment('quantity', $item->quantity);
        }
    }
}
