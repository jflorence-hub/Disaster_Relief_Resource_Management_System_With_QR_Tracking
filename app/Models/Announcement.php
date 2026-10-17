<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'body',
        'audience',
        'location_id',
        'sent_by',
    ];

    /**
     * The admin/staff user who created this announcement.
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    /**
     * The barangay this announcement is targeted at (audience = barangay only).
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }
}