import ConfirmDialog from '@/components/confirm-dialog';
import AppLayout from '@/layouts/app-layout';
import { QrScan } from '@/types/models';
import { Head, router } from '@inertiajs/react';
import {
    Trash2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Download,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduleFamily {
    id: number;
    status: string;
    excluded: boolean;
    exclusion_reason: string | null;
    quantity: number;
    family_code: string;
    head_name: string;
    location_id: number | null;
    purok_name: string | null;
    resource_name: string | null;
    resource_unit: string | null;
    scanned_by: string | null;
    receiver: string | null;
    scan_time: string | null;
}

interface ScheduleEntry {
    id: number;
    scheduled_at: string;
    resource_name: string | null;
    location_name: string | null;
    families: ScheduleFamily[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

const statusBadge: Record<string, string> = {
    completed: 'badge-green',
    pending: 'badge-slate',
    cancelled: 'badge-red',
    excluded: 'bg-red-100 text-red-600',
};

function toYMD(dateStr: string) {
    return dateStr.substring(0, 10);
}

function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay(); // 0=Sun
}

// ── Calendar dot helper ───────────────────────────────────────────────────────

function dayStatus(
    families: ScheduleFamily[],
): 'none' | 'pending' | 'completed' | 'excluded' | 'mixed' {
    if (!families.length) return 'none';
    const hasExcluded = families.some((f) => f.excluded);
    const hasPending = families.some(
        (f) => f.status === 'pending' && !f.excluded,
    );
    const hasCompleted = families.some((f) => f.status === 'completed');
    if (hasExcluded && hasPending) return 'mixed';
    if (hasPending) return 'pending';
    if (hasExcluded) return 'excluded';
    if (hasCompleted) return 'completed';
    return 'none';
}

const dotColor: Record<string, string> = {
    completed: 'bg-green-500',
    pending: 'bg-amber-400',
    excluded: 'bg-red-500',
    mixed: 'bg-amber-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function QrTracking({
    scans,
    userRole,
    scheduleHistory = [],
    allLocations = [],
}: {
    scans: QrScan[];
    userRole: string;
    scheduleHistory: ScheduleEntry[];
    allLocations: { id: number; name: string }[];
}) {
    const [activeView, setActiveView] = useState<'history' | 'scans'>(
        'history',
    );
    const today = new Date();
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed
    const [selectedDay, setSelectedDay] = useState<string | null>(null); // YYYY-MM-DD
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
    const [calendarExpanded, setCalendarExpanded] = useState(true);
    const [filterLocation, setFilterLocation] = useState<string>('');
    const [historySearch, setHistorySearch] = useState('');
    const [scanPage, setScanPage] = useState(1);
    const pageSize = 10;

    const [deleting, setDeleting] = useState<QrScan | null>(null);

    // ── auto-refresh ──────────────────────────────────────────────────────────
    useEffect(() => {
        const id = setInterval(() => {
            if (!deleting)
                router.reload({ only: ['scans', 'scheduleHistory'] });
        }, 15000);
        return () => clearInterval(id);
    }, [deleting]);

    // ── calendar data ─────────────────────────────────────────────────────────
    // Build a map: YYYY-MM-DD -> ScheduleFamily[]
    const dayMap = useMemo(() => {
        const map: Record<string, ScheduleFamily[]> = {};
        scheduleHistory.forEach((s) => {
            const day = toYMD(s.scheduled_at);
            if (!map[day]) map[day] = [];
            let fams = s.families;
            if (filterLocation)
                fams = fams.filter(
                    (f) => String(f.location_id) === filterLocation,
                );
            map[day].push(...fams);
        });
        return map;
    }, [scheduleHistory, filterLocation]);

    // Filtered schedules for the selected day
    const selectedDaySchedules = useMemo(() => {
        if (!selectedDay) return [];
        return scheduleHistory
            .filter((s) => toYMD(s.scheduled_at) === selectedDay)
            .map((s) => ({
                ...s,
                families: filterLocation
                    ? s.families.filter(
                          (f) => String(f.location_id) === filterLocation,
                      )
                    : s.families,
            }))
            .filter((s) => s.families.length > 0);
    }, [selectedDay, scheduleHistory, filterLocation]);
    const visibleSchedule =
        selectedDaySchedules.find(
            (schedule) => String(schedule.id) === selectedScheduleId,
        ) ?? selectedDaySchedules[0];

    // Search across whole month
    const searchResults = useMemo(() => {
        if (!historySearch.trim()) return null;
        const q = historySearch.toLowerCase();
        return scheduleHistory.flatMap((s) =>
            s.families
                .filter(
                    (f) =>
                        f.head_name.toLowerCase().includes(q) ||
                        (s.location_name ?? '').toLowerCase().includes(q) ||
                        (f.purok_name ?? '').toLowerCase().includes(q),
                )
                .map((f) => ({
                    ...f,
                    scheduled_at: s.scheduled_at,
                    location_name: s.location_name,
                    resource_name: s.resource_name,
                })),
        );
    }, [historySearch, scheduleHistory]);
    const scanPageCount = Math.max(1, Math.ceil(scans.length / pageSize));
    const safeScanPage = Math.min(scanPage, scanPageCount);
    const visibleScans = scans.slice(
        (safeScanPage - 1) * pageSize,
        safeScanPage * pageSize,
    );

    // ── calendar rendering ────────────────────────────────────────────────────
    const daysCount = daysInMonth(calYear, calMonth);
    const firstDay = firstDayOfMonth(calYear, calMonth);
    const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString(
        'en-US',
        { month: 'long', year: 'numeric' },
    );

    const prevMonth = () => {
        if (calMonth === 0) {
            setCalYear((y) => y - 1);
            setCalMonth(11);
        } else setCalMonth((m) => m - 1);
        setSelectedDay(null);
        setSelectedScheduleId('');
    };
    const nextMonth = () => {
        if (calMonth === 11) {
            setCalYear((y) => y + 1);
            setCalMonth(0);
        } else setCalMonth((m) => m + 1);
        setSelectedDay(null);
        setSelectedScheduleId('');
    };

    // ── export CSV ────────────────────────────────────────────────────────────
    const exportCsv = () => {
        const rows: string[][] = [
            [
                'Date',
                'Location',
                'Barangay',
                'Family Head',
                'Purok',
                'Resource',
                'Qty',
                'Status',
                'Scanned By',
                'Received By',
                'Scan Time',
            ],
        ];
        const prefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
        scheduleHistory.forEach((s) => {
            if (!toYMD(s.scheduled_at).startsWith(prefix)) return;
            s.families.forEach((f) => {
                rows.push([
                    toYMD(s.scheduled_at),
                    s.location_name ?? '',
                    '',
                    f.head_name,
                    f.purok_name ?? '',
                    f.resource_name ?? '',
                    String(f.quantity),
                    f.excluded ? 'excluded' : f.status,
                    f.scanned_by ?? '',
                    f.receiver ?? '',
                    f.scan_time ?? '',
                ]);
            });
        });
        const csv = rows
            .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `distribution-${prefix}.csv`;
        a.click();
    };

    const confirmDelete = () => {
        if (!deleting) return;
        router.delete(`/qr-tracking/${deleting.id}`, {
            onFinish: () => setDeleting(null),
        });
    };

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <AppLayout
            title="QR Tracking"
            subtitle="Distribution history and scan log"
        >
            <Head title="QR Tracking" />

            <div className="mb-5 flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                    type="button"
                    onClick={() => setActiveView('history')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        activeView === 'history'
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    Distribution History
                </button>
                <button
                    type="button"
                    onClick={() => setActiveView('scans')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        activeView === 'scans'
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    Scan Logs
                </button>
            </div>

            {/* Distribution and scan history */}
            {activeView === 'history' && (
                <div className="mb-4 space-y-4">
                    {/* Controls row */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Month navigator */}
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                            <button
                                type="button"
                                onClick={prevMonth}
                                className="p-1 hover:text-blue-600"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="min-w-[140px] text-center text-sm font-semibold text-slate-700">
                                {monthLabel}
                            </span>
                            <button
                                type="button"
                                onClick={nextMonth}
                                className="p-1 hover:text-blue-600"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        {/* Location filter */}
                        {userRole === 'admin' && allLocations.length > 0 && (
                            <select
                                className="input-field py-1.5 text-sm sm:w-44"
                                value={filterLocation}
                                onChange={(e) => {
                                    setFilterLocation(e.target.value);
                                    setSelectedDay(null);
                                    setSelectedScheduleId('');
                                }}
                            >
                                <option value="">All Barangays</option>
                                {allLocations.map((l) => (
                                    <option key={l.id} value={String(l.id)}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        {/* Search */}
                        <input
                            type="text"
                            className="input-field py-1.5 text-sm sm:w-56"
                            placeholder="Search family or barangay…"
                            value={historySearch}
                            onChange={(e) => setHistorySearch(e.target.value)}
                        />
                        {/* Export */}
                        <button
                            type="button"
                            onClick={exportCsv}
                            className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                            <Download size={14} /> Export CSV
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setCalendarExpanded((expanded) => !expanded)
                            }
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                            aria-expanded={calendarExpanded}
                        >
                            {calendarExpanded ? (
                                <>
                                    <ChevronUp size={14} /> Hide calendar
                                </>
                            ) : (
                                <>
                                    <ChevronDown size={14} /> Show calendar
                                </>
                            )}
                        </button>
                    </div>

                    {/* Search results overlay */}
                    {searchResults !== null ? (
                        <div className="card overflow-hidden p-0">
                            <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase">
                                Search results — {searchResults.length} match
                                {searchResults.length !== 1 ? 'es' : ''}
                            </div>
                            {searchResults.length === 0 ? (
                                <p className="px-4 py-8 text-center text-sm text-slate-400">
                                    No matches found.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <DistributionTable
                                        key={historySearch}
                                        rows={searchResults.map((f) => ({
                                            ...f,
                                            location_name: (f as any)
                                                .location_name,
                                        }))}
                                        userRole={userRole}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Calendar grid */}
                            {calendarExpanded && (
                                <div className="card p-4">
                                    <div className="mb-2 grid grid-cols-7 text-center">
                                        {[
                                            'Sun',
                                            'Mon',
                                            'Tue',
                                            'Wed',
                                            'Thu',
                                            'Fri',
                                            'Sat',
                                        ].map((d) => (
                                            <div
                                                key={d}
                                                className="py-1 text-xs font-semibold text-slate-400"
                                            >
                                                {d}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {/* Empty cells for first-day offset */}
                                        {Array.from({ length: firstDay }).map(
                                            (_, i) => (
                                                <div key={`empty-${i}`} />
                                            ),
                                        )}
                                        {/* Day cells */}
                                        {Array.from({ length: daysCount }).map(
                                            (_, i) => {
                                                const dayNum = i + 1;
                                                const ymd = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                                const fams = dayMap[ymd] ?? [];
                                                const status = dayStatus(fams);
                                                const isToday =
                                                    ymd === todayStr();
                                                const isSelected =
                                                    ymd === selectedDay;

                                                // Carry-over check: pending families from a past date
                                                const hasCarryover =
                                                    status !== 'none' &&
                                                    ymd < todayStr() &&
                                                    fams.some(
                                                        (f) =>
                                                            f.status ===
                                                                'pending' &&
                                                            !f.excluded,
                                                    );

                                                return (
                                                    <button
                                                        key={ymd}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedDay(
                                                                isSelected
                                                                    ? null
                                                                    : ymd,
                                                            );
                                                            setSelectedScheduleId(
                                                                '',
                                                            );
                                                        }}
                                                        className={`relative flex flex-col items-center rounded-lg p-1.5 text-center transition-colors ${isSelected ? 'bg-blue-600 text-white' : isToday ? 'border-2 border-blue-400' : 'hover:bg-slate-50'} ${status === 'none' ? 'opacity-40' : ''} `}
                                                    >
                                                        <span
                                                            className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-700'}`}
                                                        >
                                                            {dayNum}
                                                        </span>
                                                        {status !== 'none' && (
                                                            <div className="mt-0.5 flex gap-0.5">
                                                                <span
                                                                    className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor[status]}`}
                                                                />
                                                                {hasCarryover &&
                                                                    !isSelected && (
                                                                        <span
                                                                            className="h-1.5 w-1.5 rounded-full bg-slate-400"
                                                                            title="Carry-over pending families"
                                                                        />
                                                                    )}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            },
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Expanded day records */}
                            {selectedDay && (
                                <div className="card overflow-hidden p-0">
                                    <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2.5">
                                        <span className="text-sm font-semibold text-slate-800">
                                            {new Date(
                                                selectedDay + 'T12:00:00',
                                            ).toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })}
                                        </span>
                                        <span className="ml-auto text-xs text-slate-400">
                                            {(dayMap[selectedDay] ?? []).length}{' '}
                                            familie
                                            {(dayMap[selectedDay] ?? [])
                                                .length !== 1
                                                ? 's'
                                                : ''}
                                        </span>
                                    </div>

                                    {selectedDaySchedules.length > 1 && (
                                        <div className="border-b border-slate-100 px-4 py-3">
                                            <label
                                                htmlFor="schedule-select"
                                                className="mb-1 block text-xs font-medium text-slate-500"
                                            >
                                                Select schedule / batch
                                            </label>
                                            <select
                                                id="schedule-select"
                                                className="input-field max-w-md"
                                                value={
                                                    visibleSchedule?.id ?? ''
                                                }
                                                onChange={(e) =>
                                                    setSelectedScheduleId(
                                                        e.target.value,
                                                    )
                                                }
                                            >
                                                {selectedDaySchedules.map(
                                                    (schedule, index) => (
                                                        <option
                                                            key={schedule.id}
                                                            value={schedule.id}
                                                        >
                                                            Batch {index + 1}
                                                            {schedule.resource_name
                                                                ? ` — ${schedule.resource_name}`
                                                                : ''}
                                                            {schedule.location_name
                                                                ? ` — ${schedule.location_name}`
                                                                : ''}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </div>
                                    )}

                                    {selectedDaySchedules.length === 0 ? (
                                        <p className="px-4 py-8 text-center text-sm text-slate-400">
                                            No distributions on this day.
                                        </p>
                                    ) : visibleSchedule ? (
                                        <div key={visibleSchedule.id}>
                                            {/* Schedule sub-header */}
                                            <div className="flex flex-wrap items-center gap-3 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                                                {selectedDaySchedules.length >
                                                    1 && (
                                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
                                                        Batch{' '}
                                                        {selectedDaySchedules.findIndex(
                                                            (schedule) =>
                                                                schedule.id ===
                                                                visibleSchedule.id,
                                                        ) + 1}
                                                    </span>
                                                )}
                                                {visibleSchedule.location_name && (
                                                    <span>
                                                        📍{' '}
                                                        {
                                                            visibleSchedule.location_name
                                                        }
                                                    </span>
                                                )}
                                                {visibleSchedule.resource_name && (
                                                    <span>
                                                        📦{' '}
                                                        {
                                                            visibleSchedule.resource_name
                                                        }
                                                    </span>
                                                )}
                                                <span className="ml-auto">
                                                    {
                                                        visibleSchedule.families.filter(
                                                            (f) =>
                                                                f.status ===
                                                                'completed',
                                                        ).length
                                                    }
                                                    /
                                                    {
                                                        visibleSchedule.families
                                                            .length
                                                    }{' '}
                                                    completed
                                                </span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <DistributionTable
                                                    key={visibleSchedule.id}
                                                    rows={
                                                        visibleSchedule.families
                                                    }
                                                    userRole={userRole}
                                                />
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {activeView === 'scans' && (
                <div className="space-y-4">
                    {/* Recent scans grouped by date */}
                    <div className="card overflow-hidden p-0">
                        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                            <span className="text-sm font-semibold text-slate-800">
                                Scan Log
                            </span>
                            <span className="ml-auto text-xs text-slate-400">
                                {scans.length} records
                            </span>
                        </div>
                        {scans.length === 0 ? (
                            <p className="px-4 py-10 text-center text-sm text-slate-400">
                                No scan records yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                                            <th className="px-4 py-2">
                                                Family Head
                                            </th>
                                            <th className="px-4 py-2">Purok</th>
                                            <th className="px-4 py-2">
                                                Relief
                                            </th>
                                            <th className="px-4 py-2">Qty</th>
                                            <th className="px-4 py-2">
                                                Received By
                                            </th>
                                            <th className="px-4 py-2">
                                                Scanned By
                                            </th>
                                            <th className="px-4 py-2">
                                                Status
                                            </th>
                                            <th className="px-4 py-2">
                                                Date / Time
                                            </th>
                                            <th className="px-4 py-2" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleScans.map((s) => {
                                            const timeStr =
                                                s.scan_time ??
                                                (s.scanned_at
                                                    ? new Date(
                                                          s.scanned_at as string,
                                                      ).toLocaleTimeString(
                                                          'en-US',
                                                          {
                                                              hour: 'numeric',
                                                              minute: '2-digit',
                                                          },
                                                      )
                                                    : '');
                                            const dateStr =
                                                s.scan_date ??
                                                (s.scanned_at
                                                    ? new Date(
                                                          s.scanned_at as string,
                                                      ).toLocaleDateString(
                                                          'en-US',
                                                      )
                                                    : '');
                                            return (
                                                <tr
                                                    key={s.id}
                                                    className="border-t border-slate-50 hover:bg-slate-50"
                                                >
                                                    <td className="px-4 py-2.5 font-medium text-slate-800">
                                                        {s.family?.head_name ??
                                                            '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-500">
                                                        {(s.family as any)
                                                            ?.purok ?? '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-500">
                                                        {s.resource_label ??
                                                            s.resource?.name ??
                                                            '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-600">
                                                        {s.quantity_change > 0
                                                            ? `+${s.quantity_change}`
                                                            : s.quantity_change}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-500">
                                                        {s.receiver ?? '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-500">
                                                        {s.scanner?.name ?? '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span
                                                            className={`badge ${s.scan_type === 'released' ? 'badge-green' : s.scan_type === 'returned' ? 'badge-amber' : 'badge-blue'} capitalize`}
                                                        >
                                                            {s.scan_type.replace(
                                                                /_/g,
                                                                ' ',
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-xs text-slate-400">
                                                        {dateStr} {timeStr}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        {userRole ===
                                                            'admin' && (
                                                            <button
                                                                className="rounded-lg p-1 text-red-400 hover:bg-red-50"
                                                                onClick={() =>
                                                                    setDeleting(
                                                                        s,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2
                                                                    size={14}
                                                                />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <TablePagination
                            count={scans.length}
                            page={safeScanPage}
                            pageSize={pageSize}
                            onPageChange={setScanPage}
                        />
                    </div>
                </div>
            )}

            {userRole === 'admin' && (
                <ConfirmDialog
                    open={!!deleting}
                    onClose={() => setDeleting(null)}
                    onConfirm={confirmDelete}
                    message="Delete this scan record?"
                />
            )}
        </AppLayout>
    );
}

// ── Shared table component ────────────────────────────────────────────────────

function DistributionTable({
    rows,
    userRole,
}: {
    rows: (ScheduleFamily & { location_name?: string | null })[];
    userRole: string;
}) {
    const getStatus = (f: ScheduleFamily) =>
        f.excluded ? 'excluded' : f.status;
    const today = new Date().toISOString().split('T')[0];
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const visibleRows = rows.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize,
    );

    return (
        <>
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                        <th className="px-4 py-2">Family Head</th>
                        <th className="px-4 py-2">Purok</th>
                        <th className="px-4 py-2">Received By</th>
                        <th className="px-4 py-2">Relief</th>
                        <th className="px-4 py-2">Scanned By</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Time</th>
                    </tr>
                </thead>
                <tbody>
                    {visibleRows.map((f, i) => {
                        const st = getStatus(f);
                        return (
                            <tr
                                key={f.id ?? i}
                                className="border-t border-slate-50 hover:bg-slate-50"
                            >
                                <td className="px-4 py-2.5 font-medium text-slate-800">
                                    {f.head_name}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500">
                                    {f.purok_name ?? '—'}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500">
                                    {f.receiver ?? '—'}
                                </td>
                                <td className="px-4 py-2.5 text-slate-600">
                                    {f.resource_name ? (
                                        <>
                                            {f.quantity}{' '}
                                            <span className="text-xs text-slate-400">
                                                {f.resource_unit}
                                            </span>{' '}
                                            {f.resource_name}
                                        </>
                                    ) : (
                                        <span className="text-slate-300">
                                            —
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500">
                                    {f.scanned_by ?? '—'}
                                </td>
                                <td className="px-4 py-2.5">
                                    <span
                                        className={`badge ${statusBadge[st] ?? 'badge-slate'} capitalize`}
                                    >
                                        {st.replace('_', ' ')}
                                    </span>
                                    {f.status === 'pending' &&
                                        !f.excluded &&
                                        (f as any).scheduled_at &&
                                        toYMD((f as any).scheduled_at) <
                                            today && (
                                            <span className="ml-1 text-xs text-slate-400 italic">
                                                carry-over
                                            </span>
                                        )}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-400">
                                    {f.scan_time ?? '—'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <TablePagination
                count={rows.length}
                page={safePage}
                pageSize={pageSize}
                onPageChange={setPage}
            />
        </>
    );
}

function TablePagination({
    count,
    page,
    pageSize,
    onPageChange,
}: {
    count: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
}) {
    const pageCount = Math.max(1, Math.ceil(count / pageSize));

    if (count <= pageSize) return null;

    return (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <p className="text-xs text-slate-500">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, count)} of {count}
            </p>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                >
                    Previous
                </button>
                <span className="text-xs text-slate-500">
                    Page {page} of {pageCount}
                </span>
                <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                    disabled={page >= pageCount}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
