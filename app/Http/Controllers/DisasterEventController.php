<?php

namespace App\Http\Controllers;

use App\Models\DisasterEvent;
use App\Models\Location;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DisasterEventController extends Controller
{
    public function index(): Response
    {
        $events = DisasterEvent::query()
            ->withCount(['schedules' => function ($query) {
                $query->whereNull('cancelled_at');
            }])
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('starts_on')
            ->get();

        return Inertia::render('disasters', [
            'events' => $events,
            'types' => DisasterEvent::TYPES,
            'locations' => Location::query()
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;

        DisasterEvent::create($data);

        return back()->with('success', 'Disaster event created.');
    }

    public function update(Request $request, DisasterEvent $disaster): RedirectResponse
    {
        $disaster->update($this->validated($request, $disaster));

        return back()->with('success', 'Disaster event updated.');
    }

    public function destroy(DisasterEvent $disaster): RedirectResponse
    {
        $scheduleCount = DB::table('distribution_schedules')
            ->where('disaster_event_id', $disaster->id)
            ->count();

        if ($scheduleCount > 0) {
            return back()->with(
                'error',
                'This event is attached to distribution schedules and cannot be deleted. Mark it completed or cancelled instead.'
            );
        }

        $disaster->delete();

        return back()->with('success', 'Disaster event deleted.');
    }

    private function validated(Request $request, ?DisasterEvent $disaster = null): array
    {
        $affectedAreas = Location::query()->pluck('name')->all();

        if ($disaster?->affected_area && ! in_array($disaster->affected_area, $affectedAreas, true)) {
            $affectedAreas[] = $disaster->affected_area;
        }

        return $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:disaster_events,name'.($disaster ? ','.$disaster->id : '')],
            'type' => ['required', 'string', 'in:'.implode(',', DisasterEvent::TYPES)],
            'affected_area' => ['nullable', 'string', 'max:255', Rule::in($affectedAreas)],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'status' => ['required', 'in:active,completed,cancelled'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
